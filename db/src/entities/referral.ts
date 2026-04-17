import { Entity } from "electrodb";
import { ddbDoc, TABLE_NAME } from "../client.js";
import { SERVICE } from "../table-schema.js";

// A single row per (referrer, referred) pairing. Created when a user claims
// another user's referral code. Reward logic can hang off this entity later.
export const ReferralEntity = new Entity(
  {
    model: { entity: "referral", version: "1", service: SERVICE },
    attributes: {
      referrerId: { type: "string", required: true },
      referredId: { type: "string", required: true },
      referralCode: { type: "string", required: true },
      rewardedAt: { type: "string" },
      createdAt: { type: "string", default: () => new Date().toISOString(), readOnly: true },
    },
    indexes: {
      primary: {
        pk: { field: "pk", composite: ["referrerId"] },
        sk: { field: "sk", composite: ["referredId"] },
      },
      byReferred: {
        index: "gsi1",
        pk: { field: "gsi1pk", composite: ["referredId"] },
        sk: { field: "gsi1sk", composite: [] },
      },
    },
  },
  { client: ddbDoc, table: TABLE_NAME },
);

// 8-char referral code. Uses unambiguous alphabet (no 0/O/1/I) to avoid
// transcription mistakes when users read codes off a phone to a friend.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeReferralCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}
