// Global setup runs once before all test files. We log into Cognito, then
// stash the access token + idToken + sub on disk so each test file's
// per-test setup can pick them up without re-authenticating. Keeping the
// cache file in tests/integration/.cache/ (gitignored) means a normal
// `vitest run` only hits Cognito once per CI run.

import { config } from "dotenv";
import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env.test from the repo root (two levels up from this file).
const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env.test") });

const required = [
  "EDUBOOST_TEST_EMAIL",
  "EDUBOOST_TEST_PASSWORD",
  "EDUBOOST_API_URL",
  "EDUBOOST_USER_POOL_ID",
  "EDUBOOST_USER_POOL_CLIENT_ID",
];

export async function setup() {
  for (const k of required) {
    if (!process.env[k]) {
      throw new Error(
        `[integration] Missing ${k} — copy .env.test from the project root or set it explicitly.`,
      );
    }
  }

  const pool = new CognitoUserPool({
    UserPoolId: process.env.EDUBOOST_USER_POOL_ID!,
    ClientId: process.env.EDUBOOST_USER_POOL_CLIENT_ID!,
  });
  const user = new CognitoUser({
    Username: process.env.EDUBOOST_TEST_EMAIL!,
    Pool: pool,
  });
  const auth = new AuthenticationDetails({
    Username: process.env.EDUBOOST_TEST_EMAIL!,
    Password: process.env.EDUBOOST_TEST_PASSWORD!,
  });

  const session = await new Promise<{
    accessToken: string;
    idToken: string;
    sub: string;
    email: string;
    role: string | null;
    groups: string[];
  }>((resolve, reject) => {
    user.authenticateUser(auth, {
      onSuccess: (s) => {
        const idTokenPayload = s.getIdToken().payload as Record<string, unknown>;
        const sub = (idTokenPayload.sub as string) ?? "";
        const email = (idTokenPayload.email as string) ?? "";
        const role = (idTokenPayload["custom:role"] as string) ?? null;
        const groups = Array.isArray(idTokenPayload["cognito:groups"])
          ? (idTokenPayload["cognito:groups"] as string[])
          : [];
        resolve({
          accessToken: s.getAccessToken().getJwtToken(),
          idToken: s.getIdToken().getJwtToken(),
          sub,
          email,
          role,
          groups,
        });
      },
      onFailure: (err) => reject(err),
    });
  });

  // Persist the token so per-test setup files can read it without
  // re-authenticating. amazon-cognito-identity-js doesn't expose refresh
  // hooks we'd want here; tokens last ~1 hour which is more than enough
  // for a single test run.
  const cacheDir = resolve(here, ".cache");
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(
    resolve(cacheDir, "session.json"),
    JSON.stringify(session, null, 2),
    "utf8",
  );

  console.log(
    `[integration] logged in as ${session.email} (sub=${session.sub.slice(0, 8)}…, role=${session.role ?? "?"}, groups=${session.groups.join(",") || "none"})`,
  );
}

export async function teardown() {
  // No teardown — leaving the cache file around helps debugging.
}
