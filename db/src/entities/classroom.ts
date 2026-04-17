import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const ClassroomEntity = new Entity(
  {
    model: { entity: "classroom", version: "1", service: SERVICE },
    attributes: {
      classroomId: { type: "string", required: true },
      teacherId: { type: "string", required: true },
      title: { type: "string", required: true },
      subject: { type: "string", required: true },
      description: { type: "string" },
      maxStudents: { type: "number", default: 1 },
      orgId: { type: "string" },
      // Teacher-curated external resources (Drive, Docs, Slides, other URLs).
      // MVP substitute for deep Google Workspace integrations: a flat list the
      // teacher maintains by hand, rendered as hyperlinks on the classroom view.
      resources: {
        type: "list",
        items: {
          type: "map",
          properties: {
            url: { type: "string", required: true },
            label: { type: "string", required: true },
            kind: {
              type: ["drive", "docs", "slides", "sheets", "video", "other"] as const,
              default: "other",
            },
          },
        },
        default: [],
      },
      status: { type: ["draft", "active", "archived"] as const, default: "draft" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["classroomId"] },
        sk: { field: "sk", composite: [] },
      },
      byTeacher: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["teacherId"] },
        sk: { field: "gsi1sk", composite: ["status", "createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export const ClassroomMembershipEntity = new Entity(
  {
    model: { entity: "classroomMembership", version: "1", service: SERVICE },
    attributes: {
      classroomId: { type: "string", required: true },
      userId: { type: "string", required: true },
      role: { type: ["student", "teacher", "observer"] as const, required: true },
      joinedAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["classroomId"] },
        sk: { field: "sk", composite: ["userId"] },
      },
      byUser: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["userId"] },
        sk: { field: "gsi1sk", composite: ["classroomId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
