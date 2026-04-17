import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const ORG_KINDS = ["educational", "commercial"] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const ORG_MEMBER_ROLES = ["owner", "admin", "teacher", "student"] as const;
export type OrgMemberRole = (typeof ORG_MEMBER_ROLES)[number];

export const OrganizationEntity = new Entity(
  {
    model: { entity: "organization", version: "1", service: SERVICE },
    attributes: {
      orgId: { type: "string", required: true },
      name: { type: "string", required: true },
      kind: { type: ORG_KINDS, required: true },
      country: { type: "string" },
      description: { type: "string" },
      ownerId: { type: "string", required: true },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["orgId"] },
        sk: { field: "sk", composite: [] },
      },
      byOwner: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["ownerId"] },
        sk: { field: "gsi1sk", composite: ["createdAt"] },
      },
      byKind: {
        index: "gsi2",
        pk: { field: "gsi2pk", composite: ["kind"] },
        sk: { field: "gsi2sk", composite: ["createdAt"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export const OrganizationMembershipEntity = new Entity(
  {
    model: { entity: "orgMembership", version: "1", service: SERVICE },
    attributes: {
      orgId: { type: "string", required: true },
      userId: { type: "string", required: true },
      role: { type: ORG_MEMBER_ROLES, required: true },
      invitedBy: { type: "string" },
      joinedAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["orgId"] },
        sk: { field: "sk", composite: ["userId"] },
      },
      byUser: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["userId"] },
        sk: { field: "gsi1sk", composite: ["orgId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

export function makeOrgId(): string {
  return `org_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
