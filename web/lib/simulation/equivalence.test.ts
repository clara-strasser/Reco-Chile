import { describe, expect, it } from "vitest";

import type { SimulationResponse } from "@/lib/api/types";

import {
  equivalenceView,
  singleOrderSensitivity,
  singleOrderVariant,
} from "./equivalence";

/**
 * Ties mode with no actual ties (MIGRATION.md §9, Phase 4 "Open → Phase 6").
 *
 * `app.py` renders the equivalence block from the *mode*, so a list whose
 * groups are all singletons still shows the verdict and both tables with a
 * single tested order. The API omits `equivalence_sensitivity` there, and this
 * module rebuilds it from the response — copying values, never recomputing
 * one.
 */

function response(
  overrides: Partial<SimulationResponse> = {},
): SimulationResponse {
  const wishes: SimulationResponse["wishes"] = [
    {
      wish_rank: 1,
      program_id: "1:a",
      program_label: "Escuela A",
      lottery_number: 1234,
      priority_tier: "no_priority",
      lottery_population_used: 40,
      capacity: 3,
      true_applicants_last_year: 30,
      calibration_imputed: false,
      availability_probability: 0.42,
      cumulative_unavailable_before_choice: 1,
      choice_assignment_probability: 0.42,
    },
    {
      wish_rank: 2,
      program_id: "2:b",
      program_label: "Escuela B",
      lottery_number: 20,
      priority_tier: "priority_sibling",
      lottery_population_used: 40,
      capacity: 3,
      true_applicants_last_year: 30,
      calibration_imputed: false,
      availability_probability: 0.65,
      cumulative_unavailable_before_choice: 0.58,
      choice_assignment_probability: 0.38,
    },
  ];

  return {
    unmatched_risk: 0.2,
    at_risk: false,
    attention_level: "high",
    thresholds: { hard: 0.027, soft: 0.004 },
    predicted_outcome: "Escuela A",
    predicted_outcome_program_id: "1:a",
    outcomes: [
      { program_id: "1:a", label: "Escuela A", probability: 0.42 },
      { program_id: "2:b", label: "Escuela B", probability: 0.38 },
      { program_id: null, label: "Unmatched", probability: 0.2 },
    ],
    wishes,
    equivalence_sensitivity: null,
    ...overrides,
  };
}

describe("singleOrderVariant", () => {
  it("is the reference order, in list order, with no tied group", () => {
    const variant = singleOrderVariant(response());

    expect(variant.order_index).toBe(1);
    expect(variant.program_order).toEqual(["1:a", "2:b"]);
    // `api._tied_order` reports only groups with more than one member.
    expect(variant.tied_order).toEqual([]);
    expect(variant.predicted_outcome).toBe("Escuela A");
    expect(variant.predicted_outcome_program_id).toBe("1:a");
    expect(variant.unmatched_risk).toBe(0.2);
    expect(variant.at_risk).toBe(false);
  });

  it("takes the predicted outcome's own final chance", () => {
    // `wish_list.predicted_outcome_final_chance`: the assignment probability of
    // the wish that became the outcome, not the first wish's.
    expect(
      singleOrderVariant(
        response({
          predicted_outcome: "Escuela B",
          predicted_outcome_program_id: "2:b",
        }),
      ).predicted_outcome_final_chance,
    ).toBe(0.38);
  });

  it("uses the unmatched risk when nothing is assigned", () => {
    const variant = singleOrderVariant(
      response({
        predicted_outcome: "Unmatched",
        predicted_outcome_program_id: null,
        at_risk: true,
      }),
    );

    expect(variant.predicted_outcome_final_chance).toBe(0.2);
    expect(variant.at_risk).toBe(true);
  });

  it("reports a missing chance as null rather than inventing one", () => {
    const variant = singleOrderVariant(
      response({ predicted_outcome: "A school that is not on the list" }),
    );

    expect(variant.predicted_outcome_final_chance).toBeNull();
  });
});

describe("singleOrderSensitivity", () => {
  it("is a stable verdict over exactly one order", () => {
    const sensitivity = singleOrderSensitivity(response());

    expect(sensitivity.total_orders).toBe(1);
    expect(sensitivity.distinct_outcome_count).toBe(1);
    expect(sensitivity.outcome_stable).toBe(true);
    // What `_equivalence_verdict` answers for one distinct outcome and a zero
    // probability range.
    expect(sensitivity.verdict).toBe("stable");
    expect(sensitivity.variants).toHaveLength(1);
    expect(sensitivity.predicted_chance_min).toBe(0.42);
    expect(sensitivity.predicted_chance_max).toBe(0.42);
  });
});

describe("equivalenceView", () => {
  it("passes the server's sensitivity through untouched", () => {
    const sensitivity = {
      total_orders: 24,
      distinct_outcome_count: 1,
      outcome_stable: true,
      verdict: "stable_probability_shift",
      predicted_chance_min: 0.71,
      predicted_chance_max: 0.99,
      variants: [],
    };
    const simulation = response({ equivalence_sensitivity: sensitivity });

    expect(equivalenceView(simulation)).toBe(sensitivity);
  });

  it("synthesizes the one-order block when the API omits it", () => {
    expect(equivalenceView(response()).total_orders).toBe(1);
    expect(
      equivalenceView(response({ equivalence_sensitivity: undefined }))
        .total_orders,
    ).toBe(1);
  });
});
