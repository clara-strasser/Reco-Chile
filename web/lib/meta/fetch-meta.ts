/**
 * Server-side loader for `GET /meta` (MIGRATION.md §3, §4.4).
 *
 * `/meta` is the only place thresholds, limits and filter option lists come
 * from — nothing in `web/` hard-codes a threshold. The root layout calls this
 * once per render and hands the result to `<MetaProvider>` so every client
 * component reads it through `useMeta()` without a second round trip.
 *
 * This runs on the server, so it calls the FastAPI origin **directly** rather
 * than looping back through the same-origin `/api` proxy: the proxy exists to
 * keep the Python origin away from the *browser*, and a server-to-self HTTP
 * hop would need an absolute public origin it does not have. Browser code must
 * keep using `api` from `@/lib/api`.
 */
import { createApiClient } from "@/lib/api/client";
import { upstreamBaseUrl } from "@/lib/api/proxy";
import type { Meta } from "@/lib/api/types";

/**
 * Fetch `/meta` for one locale.
 *
 * @param lang - UI locale (`"es"` | `"en"`); only `message`-like copy in the
 *   response depends on it. Enumerated values stay English codes.
 */
export async function fetchMeta(lang?: string): Promise<Meta> {
  const client = createApiClient({ baseUrl: upstreamBaseUrl(), lang });
  return client.get("/meta", {
    // Calibration data is loaded once at FastAPI startup, but `/meta` carries
    // a `data_fingerprint`; re-reading it per render keeps a redeployed API
    // from serving stale limits through a long-lived Next.js cache entry.
    fetchOptions: { cache: "no-store" },
  });
}
