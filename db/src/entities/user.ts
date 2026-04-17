import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const UserEntity = new Entity(
  {
    model: { entity: "user", version: "1", service: SERVICE },
    attributes: {
      userId: { type: "string", required: true },
      email: { type: "string", required: true },
      role: { type: ["parent", "student", "teacher", "org_admin", "admin"] as const, required: true },
      displayName: { type: "string", required: true },
      avatarUrl: { type: "string" },
      cognitoSub: { type: "string", required: true },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["userId"] },
        sk: { field: "sk", composite: [] },
      },
      byEmail: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["email"] },
        sk: { field: "gsi1sk", composite: [] },
      },
      byRole: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["role"] },
        sk: { field: "gsi2sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
