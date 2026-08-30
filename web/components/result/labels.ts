"use client";

/**
 * Display labels for everything the simulation response names.
 *
 * Two rules from MIGRATION.md §3/§4.3 are enforced here, in one place:
 *
 * - **Program labels always come from the API** (`program_label`); the frontend
 *   never rebuilds one from an id. `tied_order` and `program_order` carry ids,
 *   so this module maps them back through the response's own wishes.
 * - **Enumerated values stay English codes on the wire** and are translated
 *   from `enums.*`: `Unmatched` and the four priority tiers. School names are
 *   shown verbatim — the mirror of `sae_app.i18n.display_outcome_label`.
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { SimulationResponse } from "@/lib/api/types";

export type ResultLabels = {
  /** An outcome label as the engine names it: a program label, or `Unmatched`. */
  outcome: (label: string) => string;
  /** The program label for a `program_id` (falls back to the id itself). */
  program: (programId: string) => string;
  /** A `priority_tier` code, e.g. `priority_sibling` / `no_priority`. */
  tier: (tier: string) => string;
};

export function useResultLabels(simulation: SimulationResponse): ResultLabels {
  const tOutcome = useTranslations("enums.outcome");
  const tTier = useTranslations("enums.priorityTier");

  const byId = useMemo(() => {
    const map = new Map<string, string>();
    for (const wish of simulation.wishes) {
      map.set(wish.program_id, wish.program_label);
    }
    return map;
  }, [simulation]);

  return useMemo(
    () => ({
      // Only `Unmatched` is a translatable outcome; a school name is data.
      outcome: (label) => (tOutcome.has(label) ? tOutcome(label) : label),
      program: (programId) => byId.get(programId) ?? programId,
      tier: (tier) => (tTier.has(tier) ? tTier(tier) : tier),
    }),
    [byId, tOutcome, tTier],
  );
}
