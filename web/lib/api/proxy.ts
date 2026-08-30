/**
 * Server-side plumbing for `web/app/api/[...path]/route.ts`.
 *
 * The browser never calls the FastAPI origin directly (MIGRATION.md §2): it
 * calls same-origin `/api/...`, and this module forwards the call to
 * `API_BASE_URL`. One origin means no CORS in production, the RUN/IPE stays
 * first-party from the browser's point of view, and the Python port need not
 * be published.
 *
 * PRIVACY — do not add logging here. Request bodies carry the student's
 * RUN/IPE (`/simulate`, `/recommend`) and the family's home address
 * (`/geocode`). MIGRATION.md §4.5 requires that they never reach a log, an
 * error message, or an analytics sink. Bodies are passed through as an opaque
 * string; only method, status and path may ever be observed, and nothing here
 * writes even those.
 *
 * Request headers are rebuilt, not relayed: only the three in
 * `FORWARDED_REQUEST_HEADERS` cross over (no cookies, no authorization), plus
 * one `X-Forwarded-For` this hop derives itself so FastAPI's per-IP geocoding
 * budget can be per browser rather than per proxy — see `clientAddress`.
 *
 * The URL building is kept as a pure function so it can be unit-tested without
 * a running Next.js server.
 *
 * Not to be confused with `web/proxy.ts` at the project root: that is Next 16's
 * renamed Middleware convention (locale routing), and it deliberately does not
 * match `/api/*`.
 */
import { NETWORK_ERROR_KEY } from "./errors";

/** Used when `API_BASE_URL` is unset — the dev default of MIGRATION.md §2. */
export const DEFAULT_UPSTREAM_BASE_URL = "http://localhost:8000";

/**
 * Ceiling on one upstream call. Generous on purpose: an equivalence-class
 * simulation may enumerate up to `max_exact_equiv_permutations` orders
 * server-side. It exists so a wedged upstream cannot pin a Node worker.
 */
export const UPSTREAM_TIMEOUT_MS = 120_000;

/** Request headers forwarded browser → FastAPI. Everything else is dropped. */
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  // The contract's second language selector, after `?lang=` (MIGRATION.md §3).
  "accept-language",
  "content-type",
] as const;

/**
 * Placeholder client address for a request whose origin cannot be established
 * — a direct browser→Next connection (`pnpm dev`), or a platform that does not
 * populate `X-Forwarded-For`. Every such caller shares one rate-limit bucket
 * upstream, which is exactly what happened before this header existed.
 */
export const UNKNOWN_CLIENT_ADDRESS = "unknown";

/** Response headers forwarded FastAPI → browser. */
const FORWARDED_RESPONSE_HEADERS = ["content-type", "retry-after"] as const;

export function upstreamBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const raw = env.API_BASE_URL?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_UPSTREAM_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

/**
 * Join the catch-all segments and the incoming query string onto the upstream
 * base URL.
 *
 * Next.js hands the segments percent-decoded, so each one is re-encoded: a
 * `program_id` is `"<rbd>:<program_code>"` and the colon must survive. Empty
 * and dot segments are rejected so a crafted path cannot climb out of the
 * upstream origin (`/api/..%2f..%2fadmin`).
 */
export function buildUpstreamUrl(
  segments: readonly string[],
  search = "",
  baseUrl: string = upstreamBaseUrl(),
): string {
  if (segments.length === 0) {
    throw new Error("Missing upstream path");
  }
  const encoded = segments.map((segment) => {
    if (segment === "" || segment === "." || segment === "..") {
      throw new Error(`Invalid upstream path segment: "${segment}"`);
    }
    return encodeURIComponent(segment);
  });
  const query = search.startsWith("?") ? search : search ? `?${search}` : "";
  return `${baseUrl.replace(/\/+$/, "")}/${encoded.join("/")}${query}`;
}

/**
 * The browser's address as the hop in front of Next.js saw it.
 *
 * Next 16 exposes no socket address to a route handler (`NextRequest.ip` was
 * removed and there is no `connection()` equivalent for it), so the only
 * source is the `X-Forwarded-For` a platform proxy set. Its *rightmost* entry
 * is the address that proxy observed; entries to its left are whatever the
 * client claimed and are worth nothing. Without such a proxy in front there is
 * no trustworthy value and none is invented.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return UNKNOWN_CLIENT_ADDRESS;
  const entries = forwarded
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return entries.at(-1) ?? UNKNOWN_CLIENT_ADDRESS;
}

function forwardedRequestHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("accept")) headers.set("accept", "application/json");
  // FastAPI's `_client_key` reads the rightmost X-Forwarded-For entry as "the
  // caller as the trusted hop saw it" and buckets /geocode's per-IP budget by
  // it. Without this header every browser shares the proxy's own address and
  // one family can spend the whole budget for everyone.
  //
  // The header is *set*, not relayed and extended: the incoming chain's
  // leftmost entries are unverified client claims, and Next 16 gives a route
  // handler no peer address of its own to append, so the one derived value is
  // all this hop can honestly assert. It is an address — no part of the
  // request body ever reaches a header (MIGRATION.md §4.5).
  headers.set("x-forwarded-for", clientAddress(request));
  return headers;
}

function forwardedResponseHeaders(response: Response): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  // Nothing the API returns is cacheable by a shared cache: responses depend
  // on the RUN/IPE in the request body.
  headers.set("cache-control", "no-store");
  return headers;
}

function errorEnvelopeResponse(
  status: number,
  errorKey: string,
  message: string,
): Response {
  // Shaped like the contract's envelope so the browser client's ApiError
  // parsing covers proxy failures too, without a second code path.
  return Response.json(
    { error_key: errorKey, message, params: {} },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/**
 * Forward one GET/POST request to FastAPI and stream the answer back.
 *
 * The upstream body is handed to the `Response` unread, so a large
 * `/programs` page is streamed rather than buffered.
 */
export async function proxyRequest(
  request: Request,
  segments: readonly string[],
  options: { baseUrl?: string; fetch?: typeof fetch } = {},
): Promise<Response> {
  const doFetch = options.fetch ?? globalThis.fetch;

  let url: string;
  try {
    url = buildUpstreamUrl(
      segments,
      new URL(request.url).search,
      options.baseUrl ?? upstreamBaseUrl(),
    );
  } catch {
    // The message deliberately omits the path: it is attacker-controlled.
    return errorEnvelopeResponse(404, "not_found", "Unknown API path.");
  }

  const method = request.method.toUpperCase();
  const body = method === "GET" ? undefined : await request.text();

  let upstream: Response;
  try {
    upstream = await doFetch(url, {
      method,
      headers: forwardedRequestHeaders(request),
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    // Never include the caught error: an undici cause can quote the request
    // body, which is exactly what must not escape (MIGRATION.md §4.5).
    return errorEnvelopeResponse(
      502,
      NETWORK_ERROR_KEY,
      "The estimation service is unavailable. Try again in a moment.",
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardedResponseHeaders(upstream),
  });
}
