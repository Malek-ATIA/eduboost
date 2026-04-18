import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

export const FAVORITE_KINDS = ["teacher", "organization"] as const;
export type FavoriteKind = (typeof FAVORITE_KINDS)[number];

// Bookmark a teacher profile or an organization. pk=userId (the bookmarker),
// sk=favoriteId (teacher userId OR orgId). `kind` disambiguates the two. A
// byFavorited GSI lets a teacher see "who has favourited me" without scanning.

export const FavoriteEntity = new Entity(
  {
    model: { entity: "favorite", version: "1", service: SERVICE },
    attributes: {
      userId: { type: "string", required: true },
      favoriteId: { type: "string", required: true },
      kind: { type: FAVORITE_KINDS, required: true },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["userId"] },
        sk: { field: "sk", composite: ["favoriteId"] },
      },
      byFavorited: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["favoriteId"] },
        sk: { field: "gsi1sk", composite: ["userId"] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);
