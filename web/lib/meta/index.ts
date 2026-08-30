/**
 * `/meta` in the client tree: `<MetaProvider meta={…}>` and `useMeta()`.
 *
 * The server helper `fetchMeta()` is deliberately NOT re-exported here. It
 * reads `process.env.API_BASE_URL` and talks to the FastAPI origin, so it must
 * never be pulled into a browser bundle by a client component that only wanted
 * the hook. Server components import it explicitly:
 *
 *   import { fetchMeta } from "@/lib/meta/fetch-meta";   // server components
 *   import { MetaProvider, useMeta } from "@/lib/meta";  // anywhere
 */
export { MetaProvider, useMeta, useMetaOptional } from "./meta-provider";
export type { Meta } from "@/lib/api/types";
