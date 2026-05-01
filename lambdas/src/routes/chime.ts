import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  ChimeSDKMeetingsClient,
  CreateMeetingCommand,
  CreateAttendeeCommand,
  DeleteMeetingCommand,
} from "@aws-sdk/client-chime-sdk-meetings";
import {
  ChimeSDKMediaPipelinesClient,
  CreateMediaCapturePipelineCommand,
  DeleteMediaCapturePipelineCommand,
} from "@aws-sdk/client-chime-sdk-media-pipelines";
import {
  SessionEntity,
  ClassroomMembershipEntity,
  AttendanceEntity,
  GoogleCalendarEventEntity,
  BreakoutRoomEntity,
  makeBreakoutId,
} from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";
import { cancelReminders } from "../lib/scheduler.js";
import { deleteCalendarEvent } from "../lib/google.js";

export const chimeRoutes = new Hono();

// Chime SDK Meetings + MediaPipelines control-plane regions are NOT the
// same thing as the meeting's MediaRegion (where audio/video traffic flows).
// Control planes live only in a handful of regions; eu-west-1 is NOT one of
// them, so we MUST point the SDK clients at a control-plane region while
// keeping MediaRegion: env.region in the CreateMeeting call so media still
// routes locally.
//
// Override via CHIME_CONTROL_REGION env var if AWS rolls eu-west-1 support
// out, or if a future stack lives in us-west-2 / ap-southeast-1.
const chimeControlRegion = process.env.CHIME_CONTROL_REGION ?? "eu-central-1";

const chime = new ChimeSDKMeetingsClient({ region: chimeControlRegion });
const pipelines = new ChimeSDKMediaPipelinesClient({ region: chimeControlRegion });

chimeRoutes.use("*", requireAuth);

async function canJoin(sessionData: { teacherId: string; classroomId: string }, sub: string): Promise<boolean> {
  if (sessionData.teacherId === sub) return true;
  const member = await ClassroomMembershipEntity.get({
    classroomId: sessionData.classroomId,
    userId: sub,
  }).go();
  return !!member.data;
}

chimeRoutes.post(
  "/sessions/:sessionId/join",
  zValidator("param", z.object({ sessionId: z.string() })),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");

    const session = await SessionEntity.get({ sessionId }).go();
    if (!session.data) return c.json({ error: "session not found" }, 404);

    if (!(await canJoin(session.data, sub))) return c.json({ error: "forbidden" }, 403);

    let meetingId = session.data.chimeMeetingId;
    let meetingResp;

    if (!meetingId) {
      meetingResp = await chime.send(
        new CreateMeetingCommand({
          ClientRequestToken: nanoid(),
          ExternalMeetingId: sessionId,
          MediaRegion: env.region,
        }),
      );
      meetingId = meetingResp.Meeting?.MeetingId;
      if (!meetingId) return c.json({ error: "meeting creation failed" }, 500);
      await SessionEntity.patch({ sessionId })
        .set({ chimeMeetingId: meetingId, status: "live" })
        .go();
    }

    const attendee = await chime.send(
      new CreateAttendeeCommand({
        MeetingId: meetingId,
        ExternalUserId: sub,
      }),
    );

    // Auto-mark attendance as present if no prior record exists. Teacher can
    // override later. Non-fatal — meeting join shouldn't fail over this.
    if (sub !== session.data.teacherId) {
      try {
        const existing = await AttendanceEntity.get({ sessionId, userId: sub }).go();
        if (!existing.data) {
          await AttendanceEntity.create({
            sessionId,
            userId: sub,
            status: "present",
            markedBy: sub,
          }).go();
        }
      } catch (err) {
        console.error("chime.join: auto-mark attendance failed (non-fatal)", err);
      }
    }

    return c.json({
      meeting: meetingResp?.Meeting ?? { MeetingId: meetingId },
      attendee: attendee.Attendee,
    });
  },
);

chimeRoutes.post(
  "/sessions/:sessionId/end",
  zValidator("param", z.object({ sessionId: z.string() })),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    const session = await SessionEntity.get({ sessionId }).go();
    if (!session.data?.chimeMeetingId) return c.json({ ok: true });
    if (session.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);

    if (session.data.chimePipelineId) {
      try {
        await pipelines.send(
          new DeleteMediaCapturePipelineCommand({ MediaPipelineId: session.data.chimePipelineId }),
        );
      } catch (err) {
        console.warn("delete pipeline failed (non-fatal)", err);
      }
    }
    await chime.send(new DeleteMeetingCommand({ MeetingId: session.data.chimeMeetingId }));
    const endPatch = SessionEntity.patch({ sessionId }).set({ status: "completed" });
    if (session.data.chimePipelineId) endPatch.remove(["chimePipelineId"]);
    await endPatch.go();

    // Session completed; delete any still-pending reminder schedules (non-fatal).
    try {
      await cancelReminders(sessionId);
    } catch (err) {
      console.error("chime.end: cancelReminders failed (non-fatal)", err);
    }

    // Clean up child breakouts (their Chime meetings + DDB rows). Non-fatal —
    // a stale breakout row or a 404 from Chime must not block end-of-session.
    try {
      const childBreakouts = await BreakoutRoomEntity.query
        .primary({ sessionId })
        .go({ limit: 50 });
      await Promise.all(
        childBreakouts.data.map(async (b) => {
          try {
            await chime.send(
              new DeleteMeetingCommand({ MeetingId: b.chimeMeetingId }),
            );
          } catch (err) {
            console.warn("chime.end: delete breakout meeting failed (non-fatal)", err);
          }
          await BreakoutRoomEntity.delete({
            sessionId,
            breakoutId: b.breakoutId,
          }).go();
        }),
      );
    } catch (err) {
      console.error("chime.end: breakout cleanup failed (non-fatal)", err);
    }

    // Remove any Google Calendar events linked to this session (non-fatal).
    try {
      const events = await GoogleCalendarEventEntity.query
        .primary({ sessionId })
        .go({ limit: 250 });
      await Promise.all(
        events.data.map(async (e) => {
          try {
            await deleteCalendarEvent(e.userId, e.googleEventId);
          } catch (err) {
            console.warn("chime.end: deleteCalendarEvent failed (non-fatal)", err);
          }
          await GoogleCalendarEventEntity.delete({
            sessionId,
            userId: e.userId,
          }).go();
        }),
      );
    } catch (err) {
      console.error("chime.end: Google Calendar cleanup failed (non-fatal)", err);
    }

    return c.json({ ok: true });
  },
);

chimeRoutes.post(
  "/sessions/:sessionId/recording/start",
  zValidator("param", z.object({ sessionId: z.string() })),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    const session = await SessionEntity.get({ sessionId }).go();
    if (!session.data?.chimeMeetingId) return c.json({ error: "meeting not started" }, 400);
    if (session.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);
    if (session.data.chimePipelineId) return c.json({ error: "already recording" }, 409);

    if (!env.accountId) return c.json({ error: "ACCOUNT_ID not configured" }, 500);
    const sourceArn = `arn:aws:chime::${env.accountId}:meeting:${session.data.chimeMeetingId}`;
    const s3Prefix = `${sessionId}/`;
    const sinkArn = `arn:aws:s3:::${env.recordingsBucket}/${s3Prefix}`;

    const result = await pipelines.send(
      new CreateMediaCapturePipelineCommand({
        SourceType: "ChimeSdkMeeting",
        SourceArn: sourceArn,
        SinkType: "S3Bucket",
        SinkArn: sinkArn,
        ClientRequestToken: nanoid(),
      }),
    );

    const pipelineId = result.MediaCapturePipeline?.MediaPipelineId;
    if (!pipelineId) return c.json({ error: "pipeline creation failed" }, 500);

    await SessionEntity.patch({ sessionId })
      .set({ chimePipelineId: pipelineId, recordingS3Key: s3Prefix })
      .go();

    return c.json({ pipelineId, s3Prefix });
  },
);

// ----- Breakout rooms -----------------------------------------------------
// A breakout is a child Chime meeting bound to a parent session. The teacher
// creates breakouts, assigns students, and either the teacher or an assigned
// student can fetch an attendee credential for it. Ending a breakout deletes
// the underlying Chime meeting so dangling attendees are disconnected by the
// Chime media service.

const createBreakoutSchema = z.object({
  label: z.string().trim().min(1).max(60),
  assignedUserIds: z.array(z.string().min(1)).max(50).default([]),
});

chimeRoutes.post(
  "/sessions/:sessionId/breakouts",
  zValidator("param", z.object({ sessionId: z.string() })),
  zValidator("json", createBreakoutSchema),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    const { label, assignedUserIds } = c.req.valid("json");

    const session = await SessionEntity.get({ sessionId }).go();
    if (!session.data) return c.json({ error: "session_not_found" }, 404);
    if (session.data.teacherId !== sub) return c.json({ error: "only_teachers" }, 403);

    const meetingResp = await chime.send(
      new CreateMeetingCommand({
        ClientRequestToken: nanoid(),
        ExternalMeetingId: `${sessionId}#brk#${nanoid(8)}`,
        MediaRegion: env.region,
      }),
    );
    const chimeMeetingId = meetingResp.Meeting?.MeetingId;
    if (!chimeMeetingId) return c.json({ error: "meeting_creation_failed" }, 500);

    const breakoutId = makeBreakoutId();
    const saved = await BreakoutRoomEntity.create({
      sessionId,
      breakoutId,
      label,
      chimeMeetingId,
      createdBy: sub,
      assignedUserIds,
    }).go();

    return c.json(saved.data, 201);
  },
);

chimeRoutes.get(
  "/sessions/:sessionId/breakouts",
  zValidator("param", z.object({ sessionId: z.string() })),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    const session = await SessionEntity.get({ sessionId }).go();
    if (!session.data) return c.json({ error: "session_not_found" }, 404);
    if (!(await canJoin(session.data, sub))) return c.json({ error: "forbidden" }, 403);

    const result = await BreakoutRoomEntity.query
      .primary({ sessionId })
      .go({ limit: 50 });
    return c.json({ items: result.data });
  },
);

chimeRoutes.post(
  "/sessions/:sessionId/breakouts/:breakoutId/join",
  zValidator(
    "param",
    z.object({ sessionId: z.string(), breakoutId: z.string() }),
  ),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId, breakoutId } = c.req.valid("param");

    const [session, breakout] = await Promise.all([
      SessionEntity.get({ sessionId }).go(),
      BreakoutRoomEntity.get({ sessionId, breakoutId }).go(),
    ]);
    if (!session.data) return c.json({ error: "session_not_found" }, 404);
    if (!breakout.data) return c.json({ error: "breakout_not_found" }, 404);

    // Authz: teacher of parent session always; otherwise student must be
    // explicitly assigned to this breakout. Classroom membership alone is NOT
    // enough — breakouts are intentionally scoped.
    const isTeacher = session.data.teacherId === sub;
    const isAssigned = (breakout.data.assignedUserIds ?? []).includes(sub);
    if (!isTeacher && !isAssigned) return c.json({ error: "not_assigned" }, 403);

    const attendee = await chime.send(
      new CreateAttendeeCommand({
        MeetingId: breakout.data.chimeMeetingId,
        ExternalUserId: sub,
      }),
    );

    return c.json({
      meeting: { MeetingId: breakout.data.chimeMeetingId, MediaRegion: env.region },
      attendee: attendee.Attendee,
      breakout: breakout.data,
    });
  },
);

chimeRoutes.delete(
  "/sessions/:sessionId/breakouts/:breakoutId",
  zValidator(
    "param",
    z.object({ sessionId: z.string(), breakoutId: z.string() }),
  ),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId, breakoutId } = c.req.valid("param");

    const [session, breakout] = await Promise.all([
      SessionEntity.get({ sessionId }).go(),
      BreakoutRoomEntity.get({ sessionId, breakoutId }).go(),
    ]);
    if (!session.data) return c.json({ error: "session_not_found" }, 404);
    if (!breakout.data) return c.json({ ok: true });
    if (session.data.teacherId !== sub) return c.json({ error: "only_teachers" }, 403);

    try {
      await chime.send(new DeleteMeetingCommand({ MeetingId: breakout.data.chimeMeetingId }));
    } catch (err) {
      console.warn("breakout.delete: chime delete failed (non-fatal)", err);
    }
    await BreakoutRoomEntity.delete({ sessionId, breakoutId }).go();
    return c.json({ ok: true });
  },
);

chimeRoutes.post(
  "/sessions/:sessionId/recording/stop",
  zValidator("param", z.object({ sessionId: z.string() })),
  async (c) => {
    const { sub } = c.get("auth");
    const { sessionId } = c.req.valid("param");
    const session = await SessionEntity.get({ sessionId }).go();
    if (!session.data?.chimePipelineId) return c.json({ error: "not recording" }, 400);
    if (session.data.teacherId !== sub) return c.json({ error: "forbidden" }, 403);

    await pipelines.send(
      new DeleteMediaCapturePipelineCommand({ MediaPipelineId: session.data.chimePipelineId }),
    );
    await SessionEntity.patch({ sessionId }).remove(["chimePipelineId"]).go();
    return c.json({ ok: true });
  },
);
