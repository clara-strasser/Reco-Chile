import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { formatInt, formatPercent } from "../lib/format";
import es from "../messages/es";
import en from "../messages/en";

/**
 * Step 3 parity (MIGRATION.md Phase 4 exit gate: "Playwright parity for the
 * strict and equivalence golden fixtures (rendered percentages equal fixture
 * values)").
 *
 * The fixtures under `tests/fixtures/golden/` were generated from the
 * pre-migration Streamlit engine (§6.1) and are the numerical baseline for the
 * whole migration. These tests drive the real wizard against the real FastAPI
 * (Playwright starts both, see `playwright.config.ts`), then compare every
 * rendered percentage with `formatPercent(<fixture value>)` — the mirror of the
 * prototype's `{:.1%}`. Nothing is hard-coded: change the data and the fixtures
 * change with it, and these tests follow.
 *
 * How the list is built: the wizard persists `wishes` to `sessionStorage`
 * (§4.2), so the fixture's exact list — including its preference groups — is
 * seeded there before the first paint. Driving the step-2 combobox for a
 * twelve-wish scarce list would test the search box, not the result, and the
 * RUN/IPE is deliberately *not* seedable (it is memory-only), so it is always
 * typed into the step-1 field, exactly as a family would.
 */

// --- Fixtures --------------------------------------------------------------

type FixtureWish = {
  program_id: string;
  preference_group: number;
  priority_sibling: boolean;
  priority_student: boolean;
  priority_parent_civil_servant: boolean;
  priority_ex_student: boolean;
  priority_already_registered: boolean;
};

type Choice = {
  program: string;
  program_id: string;
  choice_assignment_probability: number;
  cumulative_unavailable_after_choice: number;
};

type Variant = {
  predicted_outcome: string;
  predicted_outcome_final_chance: number;
};

type Fixture = {
  name: string;
  inputs: {
    student_id: string;
    use_equivalence_classes: boolean;
    wishes: FixtureWish[];
  };
  expected: {
    unmatched_risk?: number;
    choices?: Choice[];
    reference_choices?: Choice[];
    variants?: Variant[];
    distinct_outcomes?: string[];
    total_orders?: number;
  };
};

function golden(name: string): Fixture {
  const path = resolve(
    process.cwd(),
    "../tests/fixtures/golden",
    `${name}.json`,
  );
  return JSON.parse(readFileSync(path, "utf8")) as Fixture;
}

const STRICT = golden("strict_04_eight_wishes_scarce");
const EQUIV_STABLE = golden("equiv_01_two_tied_stable_outcome");
const EQUIV_OUTCOME_CHANGES = golden("equiv_02_two_groups_of_three");
const EQUIV_SHIFT = golden("equiv_03_group_of_four_probability_shift");

/**
 * Ties mode over a list where nothing is actually tied: the same three wishes
 * as `strict_02`, each still in its own preference group. `count_equivalence_
 * orders` answers 1, so `/simulate` returns `equivalence_sensitivity: null` —
 * and the step must still render what `app.py` renders, because the *mode* is
 * what decides the block (MIGRATION.md §9, Phase 4 "Open → Phase 6").
 */
const TIES_WITHOUT_GROUPS: Fixture = (() => {
  const base = golden("strict_02_three_wishes");
  return {
    ...base,
    name: "ties_mode_without_groups",
    inputs: { ...base.inputs, use_equivalence_classes: true },
  };
})();

/**
 * Six programs in one group — 6! = 720 compatible strict orders, the largest
 * count that is still quick to compute for a test (the reachable maximum is
 * 7! = 5,040). It exists to prove the technical table does not put every order
 * in the DOM at once.
 */
const SIX_IN_ONE_GROUP: Fixture = {
  name: "six_wishes_one_group",
  inputs: {
    student_id: STRICT.inputs.student_id,
    use_equivalence_classes: true,
    wishes: STRICT.inputs.wishes
      .slice(0, 6)
      .map((wish) => ({ ...wish, preference_group: 1 })),
  },
  expected: {},
};

/** 6! — what `count_equivalence_orders` reports for one group of six. */
const SIX_IN_ONE_GROUP_ORDERS = 720;

/** Rows a permutation table shows before "Show more" (`PAGE_SIZE`). */
const PAGE_SIZE = 50;

/**
 * `wish_list.predicted_outcome_from_choices`, restated from the fixture: the
 * hard threshold wins, otherwise the most likely program. Used to assert the
 * school the stable verdict names.
 */
function predictedOutcome(fixture: Fixture, hardThreshold: number): string {
  const choices = referenceChoices(fixture);
  if (unmatchedRisk(fixture) >= hardThreshold)
    return es.enums.outcome.Unmatched;
  const best = [...choices]
    .filter((choice) => choice.choice_assignment_probability > 0)
    .sort(
      (a, b) =>
        b.choice_assignment_probability - a.choice_assignment_probability,
    )[0];
  return best ? best.program : es.enums.outcome.Unmatched;
}

/** A catalogue sentence with its placeholders filled and its `<b>` dropped. */
function copy(message: string, values: Record<string, string>): string {
  return Object.entries(values)
    .reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), message)
    .replace(/<\/?b>/g, "");
}

/** The unmatched risk of a fixture, wherever it keeps it. */
function unmatchedRisk(fixture: Fixture): number {
  if (typeof fixture.expected.unmatched_risk === "number") {
    return fixture.expected.unmatched_risk;
  }
  const choices = fixture.expected.reference_choices ?? [];
  return choices[choices.length - 1].cumulative_unavailable_after_choice;
}

function referenceChoices(fixture: Fixture): Choice[] {
  return fixture.expected.choices ?? fixture.expected.reference_choices ?? [];
}

/** The verdict `_equivalence_verdict` computes for a fixture, given /meta's
 *  probability-change threshold — recomputed here so the test states the rule
 *  instead of restating the server's answer. */
function expectedVerdict(fixture: Fixture, threshold: number): string {
  const variants = fixture.expected.variants ?? [];
  const distinct = new Set(
    variants.map((variant) => variant.predicted_outcome),
  );
  if (distinct.size !== 1) return "outcome_changes";
  const chances = variants.map((v) => v.predicted_outcome_final_chance);
  const range = Math.max(...chances) - Math.min(...chances);
  return range >= threshold ? "stable_probability_shift" : "stable";
}

// --- Store seeding ---------------------------------------------------------

/** Mirrors `WIZARD_PERSIST_KEY` / `WIZARD_PERSIST_VERSION` in the store. */
const PERSIST_KEY = "reco-chile.wizard";
const PERSIST_VERSION = 1;

async function seedList(page: Page, fixture: Fixture): Promise<void> {
  const ties = fixture.inputs.use_equivalence_classes;
  const state = {
    listExists: true,
    useEquivalenceClasses: ties,
    wishes: fixture.inputs.wishes.map((wish) => ({
      programId: wish.program_id,
      equivalenceGroup: ties ? wish.preference_group : null,
      prioritySibling: wish.priority_sibling,
      priorityStudent: wish.priority_student,
      priorityParentCivilServant: wish.priority_parent_civil_servant,
      priorityExStudent: wish.priority_ex_student,
      priorityAlreadyRegistered: wish.priority_already_registered,
    })),
  };

  await page.addInitScript(
    ([key, value]) => {
      window.sessionStorage.setItem(key, value);
    },
    [PERSIST_KEY, JSON.stringify({ state, version: PERSIST_VERSION })] as const,
  );
}

/** Type the RUN on step 1, then walk the stepper to step 3 — a client-side
 *  navigation, because a reload would drop the memory-only identifier. */
async function openResult(
  page: Page,
  fixture: Fixture,
  locale: "es" | "en" = "es",
): Promise<void> {
  const messages = locale === "es" ? es : en;
  await seedList(page, fixture);
  await page.goto(`/${locale}/student`);

  await page
    .getByLabel(messages.student.idLabel)
    .fill(fixture.inputs.student_id);
  await expect(page.getByTestId("student-id-feedback")).toHaveAttribute(
    "data-state",
    "valid",
  );

  await page
    .getByRole("navigation", { name: messages.steps.navLabel })
    .getByRole("link", { name: `3. ${messages.steps.result}` })
    .click();
  await page.waitForURL(`**/${locale}/result`);
}

/** `/meta` through the same-origin proxy the browser uses. */
async function meta(page: Page): Promise<{
  equiv_probability_change_warning_threshold: number;
  soft_unmatched_threshold: number;
  hard_unmatched_threshold: number;
}> {
  const response = await page.request.get("/api/meta");
  expect(response.ok()).toBeTruthy();
  return response.json();
}

// --- Tests -----------------------------------------------------------------

test.describe("result step — strict list", () => {
  test("renders the golden unmatched risk and every final chance", async ({
    page,
  }) => {
    await openResult(page, STRICT);

    const risk = page.getByTestId("unmatched-risk");
    await expect(risk).toHaveText(formatPercent(unmatchedRisk(STRICT), "es"));
    // 54.8% is above the hard threshold, so the prototype shows "high".
    await expect(page.getByTestId("attention-alert")).toHaveAttribute(
      "data-level",
      "high",
    );
    await expect(page.getByTestId("attention-alert")).toHaveText(
      es.result.attention.high,
    );

    for (const choice of referenceChoices(STRICT)) {
      await expect(
        page.locator(
          `[data-testid="final-chance"][data-program-id="${choice.program_id}"]`,
        ),
      ).toHaveText(formatPercent(choice.choice_assignment_probability, "es"));
    }

    // The family table lists the whole list, in order.
    await expect(page.getByTestId("final-chance")).toHaveCount(
      STRICT.inputs.wishes.length,
    );
  });

  test("the podium, the detail table and the outcome order match the engine", async ({
    page,
  }) => {
    await openResult(page, STRICT);

    // Outcomes are sorted by probability, `Unmatched` included (§3).
    const choices = referenceChoices(STRICT);
    const outcomes = [
      ...choices
        .filter((choice) => choice.choice_assignment_probability > 0)
        .map((choice) => ({
          label: choice.program,
          probability: choice.choice_assignment_probability,
        })),
      { label: es.enums.outcome.Unmatched, probability: unmatchedRisk(STRICT) },
    ].sort((a, b) => b.probability - a.probability);

    const podium = page.getByTestId("outcome-item");
    await expect(podium).toHaveCount(Math.min(4, outcomes.length));
    for (const [index, outcome] of outcomes.slice(0, 4).entries()) {
      await expect(podium.nth(index)).toContainText(outcome.label);
      await expect(podium.nth(index)).toContainText(
        formatPercent(outcome.probability, "es"),
      );
    }

    // The detailed calculation carries the same final chances.
    await page.getByRole("button", { name: es.result.detail.trigger }).click();
    const detail = page.getByTestId("detail-table");
    await expect(detail).toBeVisible();
    for (const choice of choices) {
      await expect(
        detail.getByRole("row").filter({ hasText: choice.program }),
      ).toContainText(
        formatPercent(choice.choice_assignment_probability, "es"),
      );
    }
  });

  test("formats the same number in English", async ({ page }) => {
    await openResult(page, STRICT, "en");

    await expect(page.getByTestId("unmatched-risk")).toHaveText(
      formatPercent(unmatchedRisk(STRICT), "en"),
    );
    expect(formatPercent(unmatchedRisk(STRICT), "en")).toBe("54.8%");
    expect(formatPercent(unmatchedRisk(STRICT), "es")).toBe("54,8%");
  });

  test("keeps the RUN out of storage and out of the URL (§4.5)", async ({
    page,
  }) => {
    await openResult(page, STRICT);
    await expect(page.getByTestId("unmatched-risk")).toBeVisible();

    const stored = await page.evaluate(() => ({
      session: JSON.stringify(window.sessionStorage),
      local: JSON.stringify(window.localStorage),
    }));
    const run = STRICT.inputs.student_id;
    const bareRun = run.replace(/[.-]/g, "");
    for (const blob of [stored.session, stored.local, page.url()]) {
      expect(blob).not.toContain(run);
      expect(blob).not.toContain(bareRun);
    }
  });
});

test.describe("result step — equivalence classes", () => {
  test("a stable list says the internal order does not matter", async ({
    page,
  }) => {
    await openResult(page, EQUIV_STABLE);
    const thresholds = await meta(page);

    await expect(page.getByTestId("unmatched-risk")).toHaveText(
      formatPercent(unmatchedRisk(EQUIV_STABLE), "es"),
    );

    const verdict = page.getByTestId("equivalence-verdict");
    await expect(verdict).toHaveAttribute(
      "data-verdict",
      expectedVerdict(
        EQUIV_STABLE,
        thresholds.equiv_probability_change_warning_threshold,
      ),
    );
    await expect(verdict).toHaveAttribute("data-verdict", "stable");
    await expect(verdict).toContainText(
      EQUIV_STABLE.expected.distinct_outcomes![0],
    );

    // A stable verdict never opens the per-order view (`_family_order_view` is
    // only reached when the outcome or its probability changes).
    await expect(page.getByTestId("tied-order-view")).toHaveCount(0);
    // The family table belongs to strict mode only.
    await expect(page.getByTestId("family-table")).toHaveCount(0);
  });

  test("ties mode with nothing grouped renders the one-order block", async ({
    page,
  }) => {
    // `app.py` branches on the mode, not on the order count: with the toggle on
    // and every wish in its own group it still stores `mode: "equivalence"` and
    // `render_simulation_result` prints the stable verdict over a single tested
    // order. The API says `equivalence_sensitivity: null` here (nothing can be
    // sensitive to a single order), so this asserts the client fills it in.
    await openResult(page, TIES_WITHOUT_GROUPS);
    const thresholds = await meta(page);
    const outcome = predictedOutcome(
      TIES_WITHOUT_GROUPS,
      thresholds.hard_unmatched_threshold,
    );

    await expect(
      page.getByRole("heading", { name: es.result.equivalence.question }),
    ).toBeVisible();

    const verdict = page.getByTestId("equivalence-verdict");
    await expect(verdict).toHaveAttribute("data-verdict", "stable");
    await expect(verdict).toHaveText(
      copy(es.result.equivalence.verdict.stable, {
        n: formatInt(1, "es"),
        outcome,
      }),
    );
    await expect(page.getByTestId("equivalence-block")).toContainText(
      es.result.equivalence.advice.stable,
    );

    // Strict mode's family table and its "chance if considered" popover are
    // never part of the equivalence layout; neither is the per-order view,
    // which only opens when the verdict is not stable.
    await expect(page.getByTestId("family-table-section")).toHaveCount(0);
    await expect(page.getByTestId("tied-order-view")).toHaveCount(0);

    // Both expanders are there, and the reference table is the golden one.
    await page
      .getByRole("button", { name: es.result.equivalence.referenceTitle })
      .click();
    const reference = page.getByTestId("reference-detail-table");
    for (const choice of referenceChoices(TIES_WITHOUT_GROUPS)) {
      await expect(
        reference.getByRole("row").filter({ hasText: choice.program }),
      ).toContainText(
        formatPercent(choice.choice_assignment_probability, "es"),
      );
    }

    await page
      .getByRole("button", { name: es.result.equivalence.technicalTitle })
      .click();
    const technical = page.getByTestId("technical-variants-table");
    // One header row and exactly one tested order.
    await expect(technical.getByRole("row")).toHaveCount(2);
    await expect(technical.getByRole("row").nth(1)).toContainText(outcome);
    // A single page needs no pagination footer.
    await expect(page.getByTestId("rows-shown")).toHaveCount(0);
  });

  test("a 720-order list pages the technical table instead of dumping it", async ({
    page,
  }) => {
    // 720 permutations server-side and a ~340 KB response: slower than every
    // other case here, and worth waiting for rather than trimming the list.
    test.slow();
    await openResult(page, SIX_IN_ONE_GROUP);

    const verdict = page.getByTestId("equivalence-verdict");
    await expect(verdict).toContainText(
      formatInt(SIX_IN_ONE_GROUP_ORDERS, "es"),
      { timeout: 60_000 },
    );

    await page
      .getByRole("button", { name: es.result.equivalence.technicalTitle })
      .click();

    const rows = page.getByTestId("technical-variants-table").getByRole("row");
    const showing = (shown: number) =>
      copy(es.result.pagination.showing, {
        shown: formatInt(shown, "es"),
        total: formatInt(SIX_IN_ONE_GROUP_ORDERS, "es"),
      });

    // 720 orders, 50 rows in the DOM (plus the header).
    await expect(rows).toHaveCount(PAGE_SIZE + 1);
    await expect(page.getByTestId("rows-shown")).toHaveText(showing(PAGE_SIZE));

    await page.getByTestId("show-more-rows").click();
    await expect(rows).toHaveCount(2 * PAGE_SIZE + 1);
    await expect(page.getByTestId("rows-shown")).toHaveText(
      showing(2 * PAGE_SIZE),
    );
  });

  test("a probability shift reports the min and max chance", async ({
    page,
  }) => {
    await openResult(page, EQUIV_SHIFT);
    const thresholds = await meta(page);

    const chances = EQUIV_SHIFT.expected.variants!.map(
      (variant) => variant.predicted_outcome_final_chance,
    );
    const verdict = page.getByTestId("equivalence-verdict");
    await expect(verdict).toHaveAttribute(
      "data-verdict",
      expectedVerdict(
        EQUIV_SHIFT,
        thresholds.equiv_probability_change_warning_threshold,
      ),
    );
    await expect(verdict).toHaveAttribute(
      "data-verdict",
      "stable_probability_shift",
    );
    await expect(verdict).toContainText(
      formatPercent(Math.min(...chances), "es"),
    );
    await expect(verdict).toContainText(
      formatPercent(Math.max(...chances), "es"),
    );

    // 24 compatible orders is above the twelve-card limit, so they are grouped
    // by outcome — one group here, since the outcome itself is stable.
    await expect(page.getByTestId("order-card")).toHaveCount(0);
    await expect(page.getByTestId("grouped-outcome")).toHaveCount(1);

    // The reference-order table reproduces the fixture's reference choices.
    await page
      .getByRole("button", { name: es.result.equivalence.referenceTitle })
      .click();
    const reference = page.getByTestId("reference-detail-table");
    for (const choice of referenceChoices(EQUIV_SHIFT)) {
      await expect(
        reference.getByRole("row").filter({ hasText: choice.program }),
      ).toContainText(
        formatPercent(choice.choice_assignment_probability, "es"),
      );
    }
  });

  test("a changing outcome groups every tested order by its outcome", async ({
    page,
  }) => {
    await openResult(page, EQUIV_OUTCOME_CHANGES);
    const thresholds = await meta(page);

    const verdict = page.getByTestId("equivalence-verdict");
    await expect(verdict).toHaveAttribute(
      "data-verdict",
      expectedVerdict(
        EQUIV_OUTCOME_CHANGES,
        thresholds.equiv_probability_change_warning_threshold,
      ),
    );
    await expect(verdict).toHaveAttribute("data-verdict", "outcome_changes");
    await expect(verdict).toHaveText(
      es.result.equivalence.verdict.outcomeChanges,
    );

    await expect(page.getByTestId("tied-order-view")).toBeVisible();
    await expect(page.getByTestId("grouped-outcome")).toHaveCount(
      EQUIV_OUTCOME_CHANGES.expected.distinct_outcomes!.length,
    );

    // Every tested permutation is listed in the technical table.
    await page
      .getByRole("button", { name: es.result.equivalence.technicalTitle })
      .click();
    await expect(
      page.getByTestId("technical-variants-table").getByRole("row"),
    ).toHaveCount(EQUIV_OUTCOME_CHANGES.expected.variants!.length + 1);
  });

  test("twelve orders or fewer are shown as one card each", async ({
    page,
  }) => {
    // No golden fixture combines "few orders" with "the outcome changes", so
    // this branch is driven with a stubbed response. It asserts the rendering
    // rule of `_family_order_view`, not a number.
    await page.route("**/api/simulate*", async (route) => {
      await route.fulfill({ json: STUBBED_TWO_ORDER_RESPONSE });
    });

    await openResult(page, EQUIV_STABLE);

    const cards = page.getByTestId("order-card");
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText(
      es.result.equivalence.optionTitle.replace("{number}", "1"),
    );
    await expect(cards.first()).toContainText(
      es.result.equivalence.placeInOrder,
    );
    // The tied group is rendered as a numbered list, in the variant's order.
    await expect(cards.first().getByRole("listitem")).toHaveText([
      "Escuela A",
      "Escuela B",
    ]);
    await expect(cards.first()).toContainText("Escuela A");
    await expect(cards.first()).toContainText(formatPercent(0.42, "es"));
    await expect(page.getByTestId("grouped-outcome")).toHaveCount(0);
  });
});

test.describe("result step — failures", () => {
  test("shows the over-cap 422 in Spanish and recovers on retry", async ({
    page,
  }) => {
    // Flipped by the test itself rather than counted, so the assertion holds
    // however many times the client asks while the failure is in place.
    let failing = true;
    await page.route("**/api/simulate*", async (route) => {
      if (!failing) {
        // The retry reaches the real engine.
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 422,
        json: {
          error_key: "too_many_equivalence_orders",
          // Localized by the API; the UI prefers its own catalogue entry.
          message: "ignored",
          params: { n: 40320, limit: 10000 },
        },
      });
    });

    await openResult(page, STRICT);

    const error = page.getByTestId("result-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute(
      "data-error-key",
      "too_many_equivalence_orders",
    );
    await expect(error).toContainText(
      es.errors.too_many_equivalence_orders
        .replace("{n}", formatInt(40320, "es"))
        .replace("{limit}", formatInt(10000, "es")),
    );
    // Continue stays closed while the step has no fresh result (§4.1).
    await expect(page.getByTestId("wizard-continue")).toBeDisabled();

    failing = false;
    await page.getByTestId("result-retry").click();
    await expect(page.getByTestId("unmatched-risk")).toHaveText(
      formatPercent(unmatchedRisk(STRICT), "es"),
    );
    await expect(page.getByTestId("result-error")).toHaveCount(0);
    await expect(page.getByTestId("wizard-continue")).toBeEnabled();
  });
});

/** Two compatible orders whose predicted outcome differs — the `<= 12` card
 *  branch. Shaped exactly like a `/simulate` response (`SimulationResponse`). */
const STUBBED_TWO_ORDER_RESPONSE = {
  unmatched_risk: 0.1,
  at_risk: true,
  attention_level: "high",
  thresholds: { hard: 0.027, soft: 0.004 },
  predicted_outcome: "Escuela A",
  predicted_outcome_program_id: "1:a",
  outcomes: [
    { program_id: "1:a", label: "Escuela A", probability: 0.42 },
    { program_id: "2:b", label: "Escuela B", probability: 0.38 },
    { program_id: null, label: "Unmatched", probability: 0.1 },
  ],
  wishes: [
    {
      wish_rank: 1,
      program_id: "1:a",
      program_label: "Escuela A",
      lottery_number: 12,
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
      priority_tier: "no_priority",
      lottery_population_used: 40,
      capacity: 3,
      true_applicants_last_year: 30,
      calibration_imputed: false,
      availability_probability: 0.65,
      cumulative_unavailable_before_choice: 0.58,
      choice_assignment_probability: 0.38,
    },
  ],
  equivalence_sensitivity: {
    total_orders: 2,
    distinct_outcome_count: 2,
    outcome_stable: false,
    verdict: "outcome_changes",
    predicted_chance_min: 0.38,
    predicted_chance_max: 0.42,
    variants: [
      {
        order_index: 1,
        program_order: ["1:a", "2:b"],
        tied_order: [["1:a", "2:b"]],
        predicted_outcome: "Escuela A",
        predicted_outcome_program_id: "1:a",
        predicted_outcome_final_chance: 0.42,
        unmatched_risk: 0.1,
        at_risk: true,
      },
      {
        order_index: 2,
        program_order: ["2:b", "1:a"],
        tied_order: [["2:b", "1:a"]],
        predicted_outcome: "Escuela B",
        predicted_outcome_program_id: "2:b",
        predicted_outcome_final_chance: 0.38,
        unmatched_risk: 0.1,
        at_risk: true,
      },
    ],
  },
} as const;
