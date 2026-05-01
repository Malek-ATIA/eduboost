// Thin fetch wrapper used by every test file. Mirrors the shape of
// web/src/lib/api.ts but is server-side, ESM, and pulls auth + base URL
// from the globals set in setup.ts.

export type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  // When true, omit the Authorization header. Used to test that public
  // routes work without a session and authed routes return 401.
  anonymous?: boolean;
  // Treat non-2xx as a normal return value (returns { status, body }
  // instead of throwing). Used when a test expects a specific 4xx code.
  expectError?: boolean;
};

export type ApiResponse<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; body: unknown };

export async function api<T = unknown>(
  path: string,
  opts: ApiOptions = {},
): Promise<ApiResponse<T>> {
  const url = `${globalThis.__EDUBOOST_API_URL__}${path}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (!opts.anonymous && globalThis.__EDUBOOST_SESSION__?.accessToken) {
    headers.authorization = `Bearer ${globalThis.__EDUBOOST_SESSION__.accessToken}`;
  }
  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers,
  };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, init);
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    /* response wasn't JSON */
  }

  if (!res.ok) {
    if (opts.expectError) {
      return {
        ok: false,
        status: res.status,
        error: extractCode(parsed),
        body: parsed,
      };
    }
    throw new Error(
      `api ${opts.method ?? "GET"} ${path} → ${res.status}: ${text}`,
    );
  }

  return { ok: true, status: res.status, data: parsed as T };
}

function extractCode(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return "unknown";
}

// Convenience asserter — throws on non-2xx with a clean message instead of
// the giant body dump. Tests use it when they want a hard failure to halt
// the file rather than a soft expect-failure.
export async function expectOk<T>(
  path: string,
  opts: ApiOptions = {},
): Promise<T> {
  const r = await api<T>(path, opts);
  if (!r.ok) throw new Error(`expected 2xx, got ${r.status}`);
  return r.data;
}

export const session = () => globalThis.__EDUBOOST_SESSION__;
