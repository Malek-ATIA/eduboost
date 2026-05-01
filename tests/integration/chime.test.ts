// Live Chime SDK integration tests. THIS COSTS REAL MONEY — every full
// run hits CreateMeeting + CreateAttendee + DeleteMeeting (~$0.001/run).
//
// Flow:
//   1. Authz: anonymous + non-existent session paths return the right codes
//   2. Create a throwaway classroom owned by the test teacher
//   3. Schedule a future session against it
//   4. POST /chime/sessions/:id/join → assert real Chime response shape
//      (Meeting.MediaPlacement audio/video URLs, Attendee.JoinToken)
//   5. Breakout CRUD: create → list → close → list-empty
//   6. POST /chime/sessions/:id/end → DeleteMeeting (cleanup)
//
// We DON'T exercise recording (MediaCapturePipeline) — recording costs
// $0.017/min and needs a live attendee connected for any meaningful capture.
// Manual smoke tests cover that path; not worth the cost in CI.

import { afterAll, describe, it, expect } from "vitest";
import { api, session } from "./api";

type Classroom = { classroomId: string; teacherId: string };
type SessionRow = { sessionId: string; classroomId: string; teacherId: string };

type ChimeMeeting = {
  MeetingId?: string;
  MediaPlacement?: {
    AudioHostUrl?: string;
    AudioFallbackUrl?: string;
    SignalingUrl?: string;
    TurnControlUrl?: string;
    ScreenSharingUrl?: string;
    ScreenViewingUrl?: string;
    ScreenDataUrl?: string;
    EventIngestionUrl?: string;
  };
  MediaRegion?: string;
  ExternalMeetingId?: string;
};
type ChimeAttendee = {
  AttendeeId?: string;
  ExternalUserId?: string;
  JoinToken?: string;
};
type JoinResponse = { meeting: ChimeMeeting; attendee: ChimeAttendee };

type Breakout = {
  sessionId: string;
  breakoutId: string;
  label: string;
  chimeMeetingId: string;
  createdBy: string;
};

const isTeacher = () =>
  session().role === "teacher" || session().groups.includes("admin");

let classroomId: string | null = null;
let sessionId: string | null = null;
let endedAlready = false;

afterAll(async () => {
  // Always try to clean up the live Chime meeting even if a test failed.
  // /end is idempotent: if no chimeMeetingId exists on the row, it returns
  // { ok: true } without touching AWS.
  if (sessionId && !endedAlready) {
    try {
      await api(`/chime/sessions/${sessionId}/end`, {
        method: "POST",
        expectError: true,
      });
    } catch {
      /* best-effort cleanup */
    }
  }
});

describe("Chime — authz on /join", () => {
  it("anonymous request → 401", async () => {
    const r = await api("/chime/sessions/sess_anything/join", {
      method: "POST",
      anonymous: true,
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(401);
  });

  it("authed but non-existent session → 404 session not found", async () => {
    const r = await api("/chime/sessions/sess_does_not_exist/join", {
      method: "POST",
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(404);
  });
});

describe("Chime — full join + breakout + end flow", () => {
  it("setup: teacher creates a fresh classroom", async () => {
    if (!isTeacher()) {
      console.log("[skip] test user isn't a teacher; Chime flow needs a teacher to create a classroom + session");
      return;
    }
    const ts = Date.now();
    const r = await api<Classroom>("/classrooms", {
      method: "POST",
      body: {
        title: `[INT-TEST CHIME ${ts}] classroom`,
        subject: "Mathematics",
        description: "Throwaway classroom for the Chime integration suite.",
        maxStudents: 2,
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.teacherId).toBe(session().sub);
    classroomId = r.data.classroomId;
  });

  it("setup: create a session against the classroom (1h from now)", async () => {
    if (!classroomId) return;
    const startsAt = new Date(Date.now() + 3600_000).toISOString();
    const endsAt = new Date(Date.now() + 7200_000).toISOString();
    const r = await api<SessionRow>("/sessions", {
      method: "POST",
      body: {
        classroomId,
        startsAt,
        endsAt,
        title: "[INT-TEST CHIME] session",
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.classroomId).toBe(classroomId);
    expect(r.data.teacherId).toBe(session().sub);
    sessionId = r.data.sessionId;
  });

  it("POST /chime/sessions/:id/join — real Chime meeting + attendee", async () => {
    if (!sessionId) return;
    const r = await api<JoinResponse>(`/chime/sessions/${sessionId}/join`, {
      method: "POST",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // Assert on the Chime SDK shape — these are the fields the browser
    // actually needs. AudioHostUrl is a bare `host:port` (TURN-style), not a
    // full URL; SignalingUrl is wss://. If AWS changes the shape of either
    // of these, the SDK breaks at runtime.
    const m = r.data.meeting;
    expect(m.MeetingId).toBeTruthy();
    expect(m.MediaRegion).toBe(process.env.EDUBOOST_AWS_REGION ?? "eu-west-1");
    expect(m.MediaPlacement?.AudioHostUrl).toMatch(/:\d+$/);
    expect(m.MediaPlacement?.SignalingUrl).toMatch(/^wss?:\/\//);
    expect(m.MediaPlacement?.TurnControlUrl).toBeTruthy();

    const a = r.data.attendee;
    expect(a.AttendeeId).toBeTruthy();
    expect(a.JoinToken).toBeTruthy();
    expect(a.ExternalUserId).toBe(session().sub);
  });

  it("idempotent: a second /join returns the same meeting (Chime dedups attendee by ExternalUserId)", async () => {
    if (!sessionId) return;
    const r1 = await api<JoinResponse>(`/chime/sessions/${sessionId}/join`, {
      method: "POST",
    });
    const r2 = await api<JoinResponse>(`/chime/sessions/${sessionId}/join`, {
      method: "POST",
    });
    if (!r1.ok || !r2.ok) throw new Error("join idempotency probe failed");
    // MeetingId is stable across calls. Chime also dedups attendees by
    // ExternalUserId — the same user calling /join twice gets the SAME
    // AttendeeId back (so two browser tabs would share an attendee). If
    // multi-tab is needed later, the route would need to vary ExternalUserId.
    expect(r2.data.meeting.MeetingId).toBe(r1.data.meeting.MeetingId);
    expect(r2.data.attendee.AttendeeId).toBe(r1.data.attendee.AttendeeId);
    expect(r2.data.attendee.ExternalUserId).toBe(session().sub);
  });
});

describe("Chime — breakout CRUD", () => {
  let breakoutId: string | null = null;

  it("POST /breakouts creates a sub-meeting", async () => {
    if (!sessionId) return;
    const r = await api<Breakout>(`/chime/sessions/${sessionId}/breakouts`, {
      method: "POST",
      body: {
        label: "[INT-TEST] Group A",
        assignedUserIds: [],
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.sessionId).toBe(sessionId);
    expect(r.data.breakoutId).toBeTruthy();
    expect(r.data.chimeMeetingId).toBeTruthy();
    expect(r.data.label).toBe("[INT-TEST] Group A");
    breakoutId = r.data.breakoutId;
  });

  it("GET /breakouts lists the new breakout", async () => {
    if (!sessionId || !breakoutId) return;
    const r = await api<{ items: Breakout[] }>(
      `/chime/sessions/${sessionId}/breakouts`,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(
      r.data.items.some((b) => b.breakoutId === breakoutId),
    ).toBe(true);
  });

  it("teacher (creator) can join the breakout — real Chime attendee", async () => {
    if (!sessionId || !breakoutId) return;
    const r = await api<{
      meeting: { MeetingId?: string; MediaRegion?: string };
      attendee: ChimeAttendee;
    }>(
      `/chime/sessions/${sessionId}/breakouts/${breakoutId}/join`,
      { method: "POST" },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.meeting.MeetingId).toBeTruthy();
    expect(r.data.attendee.JoinToken).toBeTruthy();
    expect(r.data.attendee.ExternalUserId).toBe(session().sub);
  });

  it("non-assigned student cannot join (we ARE the teacher, so this just asserts the route exists with 404 on bad ids)", async () => {
    if (!sessionId) return;
    const r = await api(
      `/chime/sessions/${sessionId}/breakouts/brk_does_not_exist/join`,
      { method: "POST", expectError: true },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(404);
  });

  it("DELETE /breakouts/:id closes it", async () => {
    if (!sessionId || !breakoutId) return;
    const r = await api(
      `/chime/sessions/${sessionId}/breakouts/${breakoutId}`,
      { method: "DELETE" },
    );
    expect(r.ok).toBe(true);
  });

  it("after delete, breakout is no longer in the list", async () => {
    if (!sessionId || !breakoutId) return;
    const r = await api<{ items: Breakout[] }>(
      `/chime/sessions/${sessionId}/breakouts`,
    );
    if (!r.ok) throw new Error("list after delete failed");
    expect(r.data.items.some((b) => b.breakoutId === breakoutId)).toBe(false);
  });
});

describe("Chime — end + cleanup", () => {
  it("non-teacher /end is rejected with 403 (skipped — we are the teacher)", () => {
    if (isTeacher()) {
      console.log("[skip] test user IS the teacher; non-teacher rejection not testable");
      return;
    }
  });

  it("POST /end closes the meeting", async () => {
    if (!sessionId) return;
    const r = await api(`/chime/sessions/${sessionId}/end`, {
      method: "POST",
    });
    expect(r.ok).toBe(true);
    endedAlready = true;
  });

  it("POST /end is idempotent: second call returns ok with no Chime meeting", async () => {
    if (!sessionId) return;
    const r = await api(`/chime/sessions/${sessionId}/end`, {
      method: "POST",
    });
    expect(r.ok).toBe(true);
  });
});
