import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const ParentChildLinkEntity = new Entity(
  {
    model: { entity: "parentChildLink", version: "1", service: SERVICE },
    attributes: {
      parentId: { type: "string", required: true },
      childId: { type: "string", required: true },
      relationship: { type: ["mother", "father", "guardian"] as const, required: true },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["parentId"] },
        sk: { field: "sk", composite: ["childId"] },
      },
      byChild: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["childId"] },
        sk: { field: "gsi1sk", composite: ["parentId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
