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
  if (!res.ok) throw new Error(`api ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}
