import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

// Per-classroom shared whiteboard. Strokes are appended as opaque JSON objects;
// shape is enforced by the route zod schema. DDB item size cap is 400KB — the
// route caps list length to avoid growing past that.

export const WhiteboardEntity = new Entity(
  {
    model: { entity: "whiteboard", version: "1", service: SERVICE },
    attributes: {
      classroomId: { type: "string", required: true },
      strokes: { type: "list", items: { type: "any" }, default: [] },
      version: { type: "number", default: 0 },
      updatedAt: { type: "string", watch: "*", set: () => new Date().toISOString() },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["classroomId"] },
        sk: { field: "sk", composite: [] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
