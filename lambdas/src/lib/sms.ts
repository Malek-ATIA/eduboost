import { createHash, randomInt } from "crypto";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { env } from "../env.js";

let client: SNSClient | null = null;
function sns(): SNSClient {
  if (!client) client = new SNSClient({ region: env.region });
  return client;
}

// E.164: +<country-digits>, total 8-16 chars after the plus. Restrictive enough
// to catch clearly-malformed inputs; AWS SNS rejects anything truly invalid.
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,15}$/.test(phone);
}

export function generateOtp(): string {
  // 6 numeric digits, leading zeros preserved.
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(code: string): string {
  // SHA-256. We never persist the plaintext OTP — only the hash — so a DDB
  // read can't recover the code. Brute-force resistance relies on: 1M-code
  // space (6 digits), 10-minute expiry, and single-use semantics (hash is
  // wiped on successful verify). NOTE: POST /sms/verify does NOT enforce
  // per-user attempt rate limiting — this is a known MVP gap tracked as
  // deferred in pipeline.md. An attacker could in principle burn through
  // ~600 guesses/sec against a single expiring code; acceptable for MVP
  // given the 10-min window and single active code at a time, but should
  // be closed post-MVP with a counter + lockout.
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export async function sendSms(phoneNumber: string, body: string): Promise<void> {
  await sns().send(
    new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: body,
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
      },
    }),
  );
}
