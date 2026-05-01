import { env } from "./env";
import { currentSession } from "./cognito";
import { ApiError, friendlyMessage } from "./errors";

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
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, { ...init, headers });
  } catch (e) {
    // Browser-side network error (DNS fail, CORS block, offline). Surface a
    // message users can act on rather than "TypeError: Failed to fetch".
    throw new ApiError(
      0,
      undefined,
      "Couldn't reach the server. Check your connection and try again.",
      (e as Error).message,
    );
  }
  // NOTE (MVP tradeoff — banned-user UX): the backend returns 403
  // `{ error: "banned", reason }` for suspended accounts. We surface that as a
  // generic thrown Error here; we do NOT force-signout, redirect to a "your
  // account is suspended" screen, or strip cached session state. For MVP this
  // is acceptable (ban is rare, JWT expires in ~1h, the ban email is the
  // primary UX). Post-MVP: branch on 403+error==="banned" to route the user
  // to /banned and call signOut().
  if (!res.ok) {
    const bodyText = await res.text();
    let code: string | undefined;
    try {
      const j = JSON.parse(bodyText);
      if (typeof j?.error === "string") code = j.error;
    } catch {
      /* response wasn't JSON (e.g., a 502 HTML page from CloudFront) */
    }
    throw new ApiError(res.status, code, friendlyMessage(res.status, code), bodyText);
  }
  return res.json() as Promise<T>;
}

// Re-export for convenience so pages only need a single import.
export { ApiError } from "./errors";
