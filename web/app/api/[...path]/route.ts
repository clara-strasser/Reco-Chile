/**
 * Same-origin proxy to the FastAPI service (MIGRATION.md §2).
 *
 * `/api/<anything>` → `${API_BASE_URL ?? "http://localhost:8000"}/<anything>`,
 * query string included, status and JSON body streamed straight back. All the
 * logic lives in `lib/api/proxy.ts` so it is unit-testable; this file is only
 * the Next.js binding.
 *
 * PRIVACY: request bodies (RUN/IPE, home address) are never logged here or in
 * `proxy.ts` — MIGRATION.md §4.5.
 */
import { proxyRequest } from "@/lib/api/proxy";

// The proxy needs Node's fetch and `process.env.API_BASE_URL`; the Edge
// runtime is deprecated in Next 16 anyway.
export const runtime = "nodejs";
// Every call depends on the incoming request (query string, body, headers) and
// on data that lives in another process: nothing here may ever be prerendered
// or cached.
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

export async function GET(
  request: Request,
  context: Context,
): Promise<Response> {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export async function POST(
  request: Request,
  context: Context,
): Promise<Response> {
  const { path } = await context.params;
  return proxyRequest(request, path);
}
