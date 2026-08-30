/**
 * Helpers for the structured `tied_order` of a variant (MIGRATION.md §3:
 * "`tied_order: [[program_id, …], …]` (structured replacement for
 * `compact_tied_order_label`)").
 *
 * The engine already omits groups of one — programs whose position never
 * changes — so nothing is filtered here; only ids are turned into the labels
 * the API sent for them.
 */

import type { SimulationVariant } from "@/lib/api/types";

import type { ResultLabels } from "./labels";

/** One variant's tied groups, as display labels. */
export function tiedGroupLabels(
  variant: SimulationVariant,
  labels: ResultLabels,
): string[][] {
  return variant.tied_order.map((group) =>
    group.map((programId) => labels.program(programId)),
  );
}

/**
 * The one-line form used inside tables — the shape
 * `wish_list.compact_tied_order_label` produced: members joined by an arrow,
 * groups separated by a pipe.
 */
export function tiedOrderLine(
  variant: SimulationVariant,
  labels: ResultLabels,
): string {
  return tiedGroupLabels(variant, labels)
    .map((group) => group.join(" → "))
    .join(" | ");
}

/** The complete strict ranking of a variant, for the technical table. */
export function strictOrderLine(
  variant: SimulationVariant,
  labels: ResultLabels,
): string {
  return variant.program_order
    .map((programId) => labels.program(programId))
    .join(" → ");
}
