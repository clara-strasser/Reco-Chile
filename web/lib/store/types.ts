/**
 * Types the wizard store holds.
 *
 * `Wish` and `ProgramFilters` are frontend-owned. The API payload types
 * (`SimulationResponse`, `GeocodeResult`) are the generated ones from
 * `@/lib/api` — the store stores them verbatim and never reads their fields, so
 * a schema change cannot silently break it.
 */

import type { GeocodeResponse, SimulationResponse } from "@/lib/api/types";

/** One entry of the family's preference list. Programs are identified on the
 *  wire by `program_id = "{rbd}:{program_code}"`; labels always come from the
 *  API (MIGRATION.md §3, §10). */
export type Wish = {
  programId: string;
  /** `null` in strict mode; the preference-group number in ties mode. */
  equivalenceGroup: number | null;
  prioritySibling: boolean;
  priorityStudent: boolean;
  priorityParentCivilServant: boolean;
  priorityExStudent: boolean;
  priorityAlreadyRegistered: boolean;
};

/** The five boolean flags of a wish (four SAE priorities + "already enrolled"). */
export type PriorityFlag =
  | "prioritySibling"
  | "priorityStudent"
  | "priorityParentCivilServant"
  | "priorityExStudent"
  | "priorityAlreadyRegistered";

export const PRIORITY_FLAGS = [
  "prioritySibling",
  "priorityStudent",
  "priorityParentCivilServant",
  "priorityExStudent",
  "priorityAlreadyRegistered",
] as const satisfies readonly PriorityFlag[];

/** Region plus the ten repeatable filter lists of `GET /programs`.
 *  Values stay English internal codes; the UI translates them (§3, §4.3). */
export type ProgramFilters = {
  /** `null` = all regions. */
  region: string | null;
  tracks: string[];
  specialtySectors: string[];
  genders: string[];
  schoolDays: string[];
  rurality: string[];
  pie: string[];
  pace: string[];
  enrollmentFee: string[];
  monthlyFee: string[];
  religiousOrientation: string[];
};

// --- API payloads ----------------------------------------------------------

// Generated from `web/lib/api/openapi.json` (`pnpm api:types`) — the store
// keeps the payloads verbatim and never recomputes anything from them (§0).
export type { SimulationResponse };

/** MIGRATION.md §4.2 calls the stored geocode `GeocodeResult`; on the wire it
 *  is `GeocodeResponse`. Set only after an explicit click, never persisted (§4.5). */
export type GeocodeResult = GeocodeResponse;
