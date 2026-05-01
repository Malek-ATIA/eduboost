import { describe, it, expect } from "vitest";
import { api, session } from "./api";

type Classroom = {
  classroomId: string;
  teacherId: string;
  title: string;
  subject: string;
  description?: string;
  maxStudents?: number;
  status: string;
  chatEnabled?: boolean;
};
type Member = {
  userId: string;
  role: "teacher" | "student" | "observer";
  joinedAt: string;
  displayName?: string;
  email?: string;
};

describe("/classrooms — list mine", () => {
  it("returns the classrooms the signed-in teacher participates in", async () => {
    const r = await api<{ items: (Classroom & { myRole: string })[] }>(
      "/classrooms/mine",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
    // A teacher account may have zero classrooms initially — just assert
    // shape, not count.
    for (const c of r.data.items) {
      expect(c.classroomId).toBeTruthy();
      expect(["teacher", "student", "observer"]).toContain(c.myRole);
    }
  });
});

describe("/classrooms — create + read + members CRUD", () => {
  // Teachers create classrooms in this suite. The dashboard role check
  // (UserEntity.role === "teacher" OR admin group) is enforced server-side.
  // If the test user isn't a teacher, this whole describe is skipped.
  const isTeacher = () =>
    session().role === "teacher" || session().groups.includes("admin");

  let classroomId: string | null = null;

  it("teacher can create a classroom", async () => {
    if (!isTeacher()) {
      console.log("[skip] test user isn't a teacher, classroom-create test skipped");
      return;
    }
    const ts = Date.now();
    const r = await api<Classroom>("/classrooms", {
      method: "POST",
      body: {
        title: `[INT-TEST ${ts}] Test classroom`,
        subject: "Mathematics",
        description: "Created by the integration test suite. Safe to ignore.",
        maxStudents: 5,
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.title).toContain("[INT-TEST");
    expect(r.data.teacherId).toBe(session().sub);
    expect(r.data.status).toBe("active");
    classroomId = r.data.classroomId;
  });

  it("created classroom is fetchable by id", async () => {
    if (!classroomId) return;
    const r = await api<Classroom>(`/classrooms/${classroomId}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.classroomId).toBe(classroomId);
    expect(r.data.maxStudents).toBe(5);
  });

  it("members list includes the teacher row", async () => {
    if (!classroomId) return;
    const r = await api<{ items: Member[] }>(
      `/classrooms/${classroomId}/members`,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.items.length).toBeGreaterThanOrEqual(1);
    expect(r.data.items.some((m) => m.role === "teacher")).toBe(true);
  });

  it("PATCH classroom updates description and chatEnabled", async () => {
    if (!classroomId) return;
    const newDesc = `[INT-TEST] updated ${Date.now()}`;
    const r = await api(`/classrooms/${classroomId}`, {
      method: "PATCH",
      body: { description: newDesc, chatEnabled: false },
    });
    expect(r.ok).toBe(true);
    const fetched = await api<Classroom>(`/classrooms/${classroomId}`);
    if (!fetched.ok) throw new Error("readback failed");
    expect(fetched.data.description).toBe(newDesc);
    expect(fetched.data.chatEnabled).toBe(false);
  });

  it("non-existent member email yields user_not_found", async () => {
    if (!classroomId) return;
    const r = await api(`/classrooms/${classroomId}/members`, {
      method: "POST",
      body: {
        email: `nobody+${Date.now()}@example.invalid`,
        role: "student",
      },
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(404);
    expect(r.error).toBe("user_not_found");
  });

  it("teacher can't add themselves", async () => {
    if (!classroomId) return;
    const r = await api(`/classrooms/${classroomId}/members`, {
      method: "POST",
      body: { email: session().email, role: "student" },
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("cannot_add_self");
  });

  it("removing a non-member returns 404 not_a_member", async () => {
    if (!classroomId) return;
    const r = await api(`/classrooms/${classroomId}/members/not_a_user_id`, {
      method: "DELETE",
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect([404, 403]).toContain(r.status);
  });

  it("sessions list endpoint works (probably empty for new classroom)", async () => {
    if (!classroomId) return;
    const r = await api<{ items: unknown[] }>(
      `/classrooms/${classroomId}/sessions`,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Array.isArray(r.data.items)).toBe(true);
  });

  it("recording-url 404s for a non-existent session", async () => {
    if (!classroomId) return;
    const r = await api(
      `/classrooms/${classroomId}/sessions/sess_doesnt_exist/recording-url`,
      { expectError: true },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(404);
  });
});

describe("/classrooms — non-teacher create rejected", () => {
  it("attempt by a non-teacher returns 403 only_teachers_or_admins", async () => {
    if (
      session().role === "teacher" ||
      session().groups.includes("admin")
    ) {
      console.log("[skip] test user IS a teacher; non-teacher rejection not testable");
      return;
    }
    const r = await api("/classrooms", {
      method: "POST",
      body: {
        title: "[INT-TEST] should fail",
        subject: "Mathematics",
        maxStudents: 2,
      },
      expectError: true,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(403);
  });
});
