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
import { SessionEntity, ClassroomMembershipEntity } from "@eduboost/db";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../env.js";

export const chimeRoutes = new Hono();

const chime = new ChimeSDKMeetingsClient({ region: env.region });
const pipelines = new ChimeSDKMediaPipelinesClient({ region: env.region });

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
