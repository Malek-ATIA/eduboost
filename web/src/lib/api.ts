import { env } from "./env";
import { currentSession } from "./cognito";

async function authHeader(): Promise<Record<string, string>> {
  const session = await currentSession();
  if (!session) return {};
  return { authorization: `Bearer ${session.getAccessToken().getJwtToken()}` };
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = {
    "content-type": "application/json",
    ...(await authHeader()),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${env.apiUrl}${path}`, { ...init, headers });
  // NOTE (MVP tradeoff — banned-user UX): the backend returns 403
  // `{ error: "banned", reason }` for suspended accounts. We surface that as a
  // generic thrown Error here; we do NOT force-signout, redirect to a "your
  // account is suspended" screen, or strip cached session state. For MVP this
  // is acceptable (ban is rare, JWT expires in ~1h, the ban email is the
  // primary UX). Post-MVP: branch on 403+error==="banned" to route the user
  // to /banned and call signOut().
  if (!res.ok) throw new Error(`api ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
