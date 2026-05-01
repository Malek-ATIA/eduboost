// Per-test-file setup — runs before each file. Loads the cached session
// produced by global-setup and exposes it on globalThis so api.ts can find
// it without explicit imports in every test.

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../.env.test") });

const cachePath = resolve(here, ".cache/session.json");
const session = JSON.parse(readFileSync(cachePath, "utf8"));

declare global {
  // eslint-disable-next-line no-var
  var __EDUBOOST_SESSION__: {
    accessToken: string;
    idToken: string;
    sub: string;
    email: string;
    role: string | null;
    groups: string[];
  };
  // eslint-disable-next-line no-var
  var __EDUBOOST_API_URL__: string;
}

globalThis.__EDUBOOST_SESSION__ = session;
globalThis.__EDUBOOST_API_URL__ = process.env.EDUBOOST_API_URL!;
