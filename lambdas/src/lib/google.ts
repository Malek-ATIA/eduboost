import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { GoogleIntegrationEntity } from "@eduboost/db";
import { env } from "../env.js";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: "Bearer";
  id_token?: string;
};

// State is an opaque token carrying userId across the OAuth redirect, signed
// with env.googleStateSecret so a tampered or forged state can't bind the
// returning code to an arbitrary user.
export function signState(userId: string, ttlSeconds = 600): string {
  if (!env.googleStateSecret) throw new Error("GOOGLE_STATE_SECRET not configured");
  const payload = {
    userId,
    nonce: randomBytes(8).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", env.googleStateSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(state: string): { userId: string } | null {
  if (!env.googleStateSecret) return null;
  const dot = state.indexOf(".");
  if (dot <= 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", env.googleStateSecret).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig, "base64url");
  const expBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.userId !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleRedirectUrl,
    response_type: "code",
    scope: `openid email ${CALENDAR_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

async function exchangeCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    redirect_uri: env.googleRedirectUrl,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`google token exchange ${res.status}: ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

async function refresh(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`google refresh ${res.status}: ${await res.text()}`);
  return (await res.json()) as TokenResponse;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<{ id: string; email?: string } | null> {
  try {
    const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { sub?: string; email?: string };
    if (!json.sub) return null;
    return { id: json.sub, email: json.email };
  } catch {
    return null;
  }
}

export async function completeConnect(userId: string, code: string): Promise<void> {
  const tokens = await exchangeCode(code);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const info = await fetchGoogleUserInfo(tokens.access_token);

  await GoogleIntegrationEntity.upsert({
    userId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    scope: tokens.scope,
    googleUserId: info?.id,
    googleEmail: info?.email,
  }).go();
}

export async function getFreshAccessToken(userId: string): Promise<string | null> {
  const row = await GoogleIntegrationEntity.get({ userId }).go();
  if (!row.data) return null;
  const now = Date.now();
  const exp = new Date(row.data.expiresAt).getTime();
  if (exp - now > 60_000) return row.data.accessToken;
  if (!row.data.refreshToken) return null;
  try {
    const fresh = await refresh(row.data.refreshToken);
    const expiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
    await GoogleIntegrationEntity.patch({ userId })
      .set({ accessToken: fresh.access_token, expiresAt })
      .go();
    return fresh.access_token;
  } catch (err) {
    console.error("google.refresh failed", err);
    return null;
  }
}

export type CalendarEventInput = {
  summary: string;
  description?: string;
  startsAt: string;
  endsAt: string;
};

export async function createCalendarEvent(
  userId: string,
  input: CalendarEventInput,
): Promise<string | null> {
  const accessToken = await getFreshAccessToken(userId);
  if (!accessToken) return null;
  const row = await GoogleIntegrationEntity.get({ userId }).go();
  const calendarId = row.data?.calendarId ?? "primary";
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startsAt },
        end: { dateTime: input.endsAt },
      }),
    },
  );
  if (!res.ok) {
    console.error("google.createCalendarEvent failed", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  const accessToken = await getFreshAccessToken(userId);
  if (!accessToken) return false;
  const row = await GoogleIntegrationEntity.get({ userId }).go();
  const calendarId = row.data?.calendarId ?? "primary";
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } },
  );
  return res.ok;
}

export async function patchCalendarEvent(
  userId: string,
  eventId: string,
  input: Partial<CalendarEventInput>,
): Promise<boolean> {
  const accessToken = await getFreshAccessToken(userId);
  if (!accessToken) return false;
  const row = await GoogleIntegrationEntity.get({ userId }).go();
  const calendarId = row.data?.calendarId ?? "primary";
  const body: Record<string, unknown> = {};
  if (input.summary !== undefined) body.summary = input.summary;
  if (input.description !== undefined) body.description = input.description;
  if (input.startsAt) body.start = { dateTime: input.startsAt };
  if (input.endsAt) body.end = { dateTime: input.endsAt };
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  return res.ok;
}
