/**
 * The equivalence view of a `/simulate` response, for ties mode.
 *
 * The prototype decides which block to draw from the *mode the family chose*,
 * not from how many orders that choice happened to produce: `app.py` stores
 * `{"mode": "equivalence", …}` whenever the "undecided order" toggle is on, and
 * `ui_simulation.render_simulation_result` then always renders "Does the
 * undecided internal order matter?", the verdict, and the reference +
 * technical tables — even when the groups are all singletons and
 * `variants_df` holds a single row ("All 1 compatible strict order(s) lead
 * to: X").
 *
 * The API cannot express that on its own: `equivalence_sensitivity` is
 * attached only when `total_orders > 1` (`api.py`), because with one order
 * there is nothing to be sensitive to. So ties mode with no actual ties
 * arrives as `equivalence_sensitivity: null`, indistinguishable from a strict
 * run. This module rebuilds the one-order sensitivity the prototype would have
 * shown, from values the response already carries — no probability is
 * recomputed here (MIGRATION.md §0: the engine is the only place a number is
 * produced), every field is copied or looked up.
 */

import type {
  EquivalenceSensitivity,
  SimulationResponse,
  SimulationVariant,
} from "@/lib/api/types";

/** The engine's outcome code for "no program assigned" (`constants.py`). */
const UNMATCHED_OUTCOME = "Unmatched";

/**
 * The final chance carried by the predicted outcome — the lookup
 * `wish_list.predicted_outcome_final_chance` performs on the reference order:
 * the unmatched risk when nothing was assigned, otherwise the assignment
 * probability of the wish that became the outcome.
 */
function predictedOutcomeFinalChance(
  simulation: SimulationResponse,
): number | null {
  if (simulation.predicted_outcome === UNMATCHED_OUTCOME) {
    return simulation.unmatched_risk;
  }
  const match = simulation.wishes.find(
    (wish) => wish.program_label === simulation.predicted_outcome,
  );
  return match ? match.choice_assignment_probability : null;
}

/**
 * The response's reference order as the single variant of a one-order run.
 *
 * `tied_order` is empty by construction: `api._tied_order` reports only groups
 * with more than one member, and a list that yields exactly one compatible
 * order has none.
 */
export function singleOrderVariant(
  simulation: SimulationResponse,
): SimulationVariant {
  return {
    order_index: 1,
    program_order: simulation.wishes.map((wish) => wish.program_id),
    tied_order: [],
    predicted_outcome: simulation.predicted_outcome,
    predicted_outcome_program_id: simulation.predicted_outcome_program_id,
    predicted_outcome_final_chance: predictedOutcomeFinalChance(simulation),
    unmatched_risk: simulation.unmatched_risk,
    at_risk: simulation.at_risk,
  };
}

/**
 * The sensitivity block for a ties-mode run whose groups produce exactly one
 * compatible strict order. Always the `stable` verdict: with a single variant
 * there is one distinct outcome and a zero probability range, which is what
 * `_equivalence_verdict` would answer.
 */
export function singleOrderSensitivity(
  simulation: SimulationResponse,
): EquivalenceSensitivity {
  const variant = singleOrderVariant(simulation);
  return {
    total_orders: 1,
    distinct_outcome_count: 1,
    outcome_stable: true,
    verdict: "stable",
    predicted_chance_min: variant.predicted_outcome_final_chance,
    predicted_chance_max: variant.predicted_outcome_final_chance,
    variants: [variant],
  };
}

/**
 * What the ties-mode result step renders: the server's sensitivity when the
 * list really has several compatible orders, and the synthesized one-order
 * block otherwise. Call it only in ties mode — the caller branches on the
 * store's `useEquivalenceClasses`, never on this field.
 */
export function equivalenceView(
  simulation: SimulationResponse,
): EquivalenceSensitivity {
  return (
    simulation.equivalence_sensitivity ?? singleOrderSensitivity(simulation)
  );
}
