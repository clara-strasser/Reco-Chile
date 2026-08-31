/* THROWAWAY parity-dump spec (Phase 6 side-by-side). Deleted after the run. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import en from "../messages/en";
import es from "../messages/es";

const OUT = process.env.PARITY_OUT ?? "/tmp/parity";
mkdirSync(OUT, { recursive: true });

type Wish = {
  program_id: string;
  preference_group: number;
  priority_sibling: boolean;
  priority_student: boolean;
  priority_parent_civil_servant: boolean;
  priority_ex_student: boolean;
  priority_already_registered: boolean;
};

function golden(name: string) {
  return JSON.parse(
    readFileSync(
      resolve(process.cwd(), "../tests/fixtures/golden", `${name}.json`),
      "utf8",
    ),
  ) as {
    inputs: {
      student_id: string;
      use_equivalence_classes: boolean;
      wishes: Wish[];
    };
  };
}

const RUN = "12345678-5";
function plain(id: string, group: number): Wish {
  return {
    program_id: id,
    preference_group: group,
    priority_sibling: false,
    priority_student: false,
    priority_parent_civil_servant: false,
    priority_ex_student: false,
    priority_already_registered: false,
  };
}

type Scenario = {
  key: string;
  studentId: string;
  ties: boolean;
  wishes: Wish[];
  improve?: boolean;
  home?: boolean;
  cityPrecision?: boolean;
};

function fromGolden(
  key: string,
  name: string,
  override?: Partial<Scenario>,
): Scenario {
  const g = golden(name);
  return {
    key,
    studentId: g.inputs.student_id,
    ties: g.inputs.use_equivalence_classes,
    wishes: g.inputs.wishes,
    ...override,
  };
}

const SCENARIOS: Scenario[] = [
  fromGolden("strict_04", "strict_04_eight_wishes_scarce"),
  fromGolden("strict_06", "strict_06_imputed_and_zero_capacity"),
  fromGolden("equiv_01", "equiv_01_two_tied_stable_outcome"),
  fromGolden("equiv_02", "equiv_02_two_groups_of_three"),
  fromGolden("equiv_03", "equiv_03_group_of_four_probability_shift"),
  fromGolden("equiv_04_over_cap", "equiv_04_over_cap"),
  {
    ...fromGolden("ties_without_ties", "strict_02_three_wishes"),
    key: "ties_without_ties",
    ties: true,
  },
  {
    key: "boundary_low",
    studentId: RUN,
    ties: false,
    wishes: [plain("9502:131000000133", 1)],
  },
  {
    key: "boundary_moderate_low",
    studentId: RUN,
    ties: false,
    wishes: [plain("14856:131000000133", 1)],
  },
  {
    key: "boundary_moderate_high",
    studentId: RUN,
    ties: false,
    wishes: [plain("2091:131000000133", 1)],
  },
  {
    key: "boundary_high",
    studentId: RUN,
    ties: false,
    wishes: [plain("8620:131000000131", 1)],
  },
  {
    key: "bare_int",
    studentId: RUN,
    ties: false,
    wishes: [plain("2935:131000000133", 1)],
  },
  {
    key: "equiv_cards",
    studentId: RUN,
    ties: true,
    wishes: [
      plain("4871:131000000133", 1),
      plain("12741:131000000133", 1),
      plain("15600:131000000133", 1),
    ],
  },
  {
    key: "badge_orange",
    studentId: RUN,
    ties: false,
    wishes: [plain("10917:131000000133", 1)],
    improve: true,
  },
  {
    ...fromGolden("recommend_no_home", "recommend_01_no_home"),
    key: "recommend_no_home",
    improve: true,
  },
  {
    ...fromGolden("recommend_home", "recommend_02_home_address_precision"),
    key: "recommend_home",
    improve: true,
    home: true,
  },
  {
    ...fromGolden("recommend_home_city", "recommend_03_home_city_precision"),
    key: "recommend_home_city",
    improve: true,
    home: true,
    cityPrecision: true,
  },
];

const CITY_WARNING =
  "El geocodificador solo pudo identificar la ciudad o comuna. Las distancias son aproximadas.";

const PERSIST_KEY = "reco-chile.wizard";
const PERSIST_VERSION = 1;

async function seed(page: Page, s: Scenario) {
  const state = {
    listExists: true,
    useEquivalenceClasses: s.ties,
    wishes: s.wishes.map((w) => ({
      programId: w.program_id,
      equivalenceGroup: s.ties ? w.preference_group : null,
      prioritySibling: w.priority_sibling,
      priorityStudent: w.priority_student,
      priorityParentCivilServant: w.priority_parent_civil_servant,
      priorityExStudent: w.priority_ex_student,
      priorityAlreadyRegistered: w.priority_already_registered,
    })),
  };
  await page.addInitScript(
    ([key, value]) => window.sessionStorage.setItem(key, value),
    [PERSIST_KEY, JSON.stringify({ state, version: PERSIST_VERSION })] as const,
  );
}

/** The welcome answer with no list — what `canEnterStep(1)` needs (§9b). */
async function seedChoice(page: Page) {
  await page.addInitScript(
    ([key, value]) => window.sessionStorage.setItem(key, value),
    [
      PERSIST_KEY,
      JSON.stringify({
        state: { listExists: true, useEquivalenceClasses: false, wishes: [] },
        version: PERSIST_VERSION,
      }),
    ] as const,
  );
}

/** The golden home: Hanga Roa, Rapa Nui (tests/generate_golden.py). */
async function stubGeocode(page: Page, city = false) {
  await page.route("**/api/geocode**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        address: "Hanga Roa",
        lat: -27.1127,
        lon: -109.3497,
        precision: city ? "city" : "address",
        display_name: "Hanga Roa, Isla de Pascua",
        warning_key: city ? CITY_WARNING : null,
        error_key: null,
        params: {},
        message: city ? CITY_WARNING : "",
      }),
    }),
  );
}

async function textsOf(page: Page, testId: string): Promise<string[]> {
  return page.getByTestId(testId).allInnerTexts();
}

async function dumpResult(page: Page) {
  const out: Record<string, unknown> = {};
  out.risk = (await textsOf(page, "unmatched-risk"))[0] ?? null;
  // §9b item 5 replaced the three-level attention alert with the positive
  // headline; the dump records what the headline now says instead.
  out.assignment_chance = (await textsOf(page, "assignment-chance"))[0] ?? null;
  out.predicted_school = (await textsOf(page, "predicted-school"))[0] ?? null;
  out.predicted_rank = (await textsOf(page, "predicted-rank"))[0] ?? null;
  out.predicted_unmatched =
    (await textsOf(page, "predicted-unmatched"))[0] ?? null;
  out.predicted_chance = (await textsOf(page, "predicted-chance"))[0] ?? null;
  out.podium = await textsOf(page, "outcome-item");
  const verdict = page.getByTestId("equivalence-verdict");
  out.verdict = (await verdict.count())
    ? await verdict.getAttribute("data-verdict")
    : null;
  out.verdict_text = (await verdict.count())
    ? (await verdict.innerText()).trim()
    : null;
  out.has_equivalence_block =
    (await page.getByTestId("equivalence-block").count()) > 0;
  out.has_tied_order_view =
    (await page.getByTestId("tied-order-view").count()) > 0;
  out.order_cards = await textsOf(page, "order-card");
  out.grouped_outcomes = await textsOf(page, "grouped-outcome");
  // Family table
  const fam = page.getByTestId("family-table");
  out.family_table = (await fam.count()) ? await fam.innerText() : null;
  for (const id of [
    "technical-variants-table",
    "reference-detail-table",
    "detail-table",
    "grouped-outcome-table",
    "rows-shown",
  ]) {
    const loc = page.getByTestId(id);
    out[id.replace(/-/g, "_")] = (await loc.count())
      ? await loc.allInnerTexts()
      : [];
  }
  const err = page.getByTestId("result-error");
  out.error = (await err.count()) ? (await err.innerText()).trim() : null;
  return out;
}

async function openDisclosures(page: Page) {
  for (let pass = 0; pass < 8; pass += 1) {
    const collapsed = page.locator(
      "[data-slot='collapsible-trigger'][aria-expanded='false']",
    );
    const n = await collapsed.count();
    if (n === 0) return;
    let clicked = 0;
    for (let i = 0; i < n; i += 1) {
      const el = collapsed.nth(0);
      try {
        await el.click({ timeout: 1500 });
        clicked += 1;
      } catch {
        break;
      }
    }
    if (clicked === 0) return;
  }
}

for (const s of SCENARIOS) {
  test(`dump ${s.key}`, async ({ page }) => {
    test.slow();
    await seed(page, s);
    if (s.home) await stubGeocode(page, s.cityPrecision === true);
    await page.goto("/es/student");
    await page.getByLabel(es.student.idLabel).fill(s.studentId);
    await expect(page.getByTestId("student-id-feedback")).toHaveAttribute(
      "data-state",
      "valid",
    );

    const nav = page.getByRole("navigation", { name: /pasos|steps/i });
    const resultLink = nav.getByRole("link", { name: /^3\./ });
    const dump: Record<string, unknown> = { key: s.key };

    if ((await resultLink.count()) === 0) {
      // step 3 is locked (over-cap list): record what step 2 says instead
      await page
        .getByRole("navigation", { name: /pasos|steps/i })
        .getByRole("link", { name: /^2\./ })
        .click();
      await page.waitForURL("**/es/list");
      dump.step3_locked = true;
      dump.list_body = await page.locator("main").innerText();
      writeFileSync(
        resolve(OUT, `${s.key}.json`),
        JSON.stringify(dump, null, 1),
      );
      return;
    }

    await resultLink.click();
    await page.waitForURL("**/es/result");
    await expect(
      page.getByTestId("unmatched-risk").or(page.getByTestId("result-error")),
    ).toBeVisible({ timeout: 120_000 });
    await openDisclosures(page);
    Object.assign(dump, await dumpResult(page));
    dump.result_body = await page.locator("main").innerText();

    if (s.improve) {
      await page.getByTestId("result-improve").click();
      await page.waitForURL("**/es/improve");
      if (s.home) {
        await page.getByTestId("home-address-input").fill("Hanga Roa");
        await page.getByTestId("geocode-submit").click();
        await expect(page.getByTestId("geocode-feedback")).toBeVisible({
          timeout: 20_000,
        });
      }
      await expect(
        page
          .getByTestId("recommendation-card")
          .first()
          .or(page.getByTestId("recommendation-empty")),
      ).toBeVisible({ timeout: 180_000 });
      const cards = page.getByTestId("recommendation-card");
      const n = await cards.count();
      const rec: unknown[] = [];
      for (let i = 0; i < n; i += 1) {
        const c = cards.nth(i);
        const trigger = c.getByRole("button", { name: /cálculo|calculation/i });
        await trigger.click();
        const pop = page.locator("[data-slot='popover-content']:visible");
        await pop.first().waitFor({ state: "visible", timeout: 10_000 });
        const detail = await pop.first().innerText();
        rec.push({
          programId: await c.getAttribute("data-program-id"),
          riskLevel: await c.getAttribute("data-risk-level"),
          text: await c.innerText(),
          calc: detail,
        });
        await page.keyboard.press("Escape");
        await expect(
          page.locator("[data-slot='popover-content']:visible"),
        ).toHaveCount(0);
      }
      dump.recommendations = rec;
      dump.recommendation_count =
        (await textsOf(page, "recommendation-count"))[0] ?? null;
      dump.current_risk =
        (await textsOf(page, "current-unmatched-risk"))[0] ?? null;
      dump.improve_body = await page.locator("main").innerText();
    }

    writeFileSync(resolve(OUT, `${s.key}.json`), JSON.stringify(dump, null, 1));
  });
}

// --- geocode precision feedback -------------------------------------------

const PRECISIONS = [
  ["address", null],
  [
    "street",
    "El geocodificador encontró la calle, pero no un punto de dirección exacto. Las distancias se calculan desde una ubicación aproximada a nivel de calle.",
  ],
  [
    "street_number",
    "El geocodificador encontró la calle, pero no pudo confirmar el número exacto. Las distancias se calculan desde una ubicación aproximada a nivel de calle.",
  ],
  [
    "city",
    "El geocodificador solo pudo identificar la ciudad o comuna. Las distancias son aproximadas.",
  ],
  [
    "approximate",
    "El geocodificador devolvió solo una ubicación aproximada. Las distancias deben interpretarse con cuidado.",
  ],
] as const;

test("dump geocode_precision", async ({ page }) => {
  test.slow();
  const s = SCENARIOS.find((x) => x.key === "recommend_no_home")!;
  const results: Record<string, string> = {};
  let current = 0;
  await page.route("**/api/geocode**", (route) => {
    const [precision, message] = PRECISIONS[current];
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        address: "Hanga Roa",
        lat: -27.1127,
        lon: -109.3497,
        precision: precision === "street_number" ? "street" : precision,
        display_name: "Hanga Roa, Isla de Pascua",
        warning_key: message,
        error_key: null,
        params: {},
        message: message ?? "",
      }),
    });
  });
  await seed(page, s);
  await page.goto("/es/student");
  await page.getByLabel(es.student.idLabel).fill(s.studentId);
  await page
    .getByRole("navigation", { name: /pasos|steps/i })
    .getByRole("link", { name: /^3\./ })
    .click();
  await page.waitForURL("**/es/result");
  await expect(page.getByTestId("unmatched-risk")).toBeVisible({
    timeout: 120_000,
  });
  await page.getByTestId("result-improve").click();
  await page.waitForURL("**/es/improve");

  for (let i = 0; i < PRECISIONS.length; i += 1) {
    current = i;
    await page.getByTestId("geocode-clear").click();
    await page.getByTestId("home-address-input").fill(`Hanga Roa ${i}`);
    await page.getByTestId("geocode-submit").click();
    const fb = page.getByTestId("geocode-feedback");
    await expect(fb).not.toBeEmpty({ timeout: 20_000 });
    results[PRECISIONS[i][0]] = JSON.stringify({
      kind: await fb.getAttribute("data-kind"),
      text: (await fb.innerText()).trim(),
      hardFilter: (await page.getByTestId("hard-filter-caption").count())
        ? (await page.getByTestId("hard-filter-caption").innerText()).trim()
        : null,
    });
  }
  writeFileSync(
    resolve(OUT, "geocode_precision.json"),
    JSON.stringify(results, null, 1),
  );
});

// --- step 2 dumps ---------------------------------------------------------

for (const key of [
  "strict_06",
  "equiv_02",
  "ties_without_ties",
  "equiv_04_over_cap",
]) {
  test(`dump list_${key}`, async ({ page }) => {
    test.slow();
    const s = SCENARIOS.find((x) => x.key === key)!;
    await seed(page, s);
    await page.goto("/es/student");
    await page.getByLabel(es.student.idLabel).fill(s.studentId);
    await page
      .getByRole("navigation", { name: /pasos|steps/i })
      .getByRole("link", { name: /^2\./ })
      .click();
    await page.waitForURL("**/es/list");
    // wait for the wish cards to resolve their labels
    await expect(page.getByText("Cargando el programa…")).toHaveCount(0, {
      timeout: 60_000,
    });
    await openDisclosures(page);
    writeFileSync(
      resolve(OUT, `list_${key}.json`),
      JSON.stringify(
        { key, body: await page.locator("main").innerText() },
        null,
        1,
      ),
    );
  });
}

// --- identifier feedback ---------------------------------------------------

test("dump identifiers", async ({ page }) => {
  test.slow();
  const cases = [
    "12345678-5",
    "12.345.678-5",
    "12345678-0",
    "100200300-4",
    "not-an-identifier",
    "٤٥٦-1",
  ];
  // Step 1 is behind the welcome answer since §9b item 2; this dump is about
  // the identifier feedback, so the answer is seeded rather than clicked.
  await seedChoice(page);
  await page.goto("/es/student");
  const out: Record<string, unknown> = {};
  const field = page.getByLabel(es.student.idLabel);
  for (const value of cases) {
    await field.fill("");
    await field.fill(value);
    const fb = page.getByTestId("student-id-feedback");
    await expect(fb).toHaveAttribute(
      "data-state",
      /valid|invalid|empty|incomplete/,
    );
    out[value] = {
      state: await fb.getAttribute("data-state"),
      text: (await fb.innerText()).trim(),
    };
  }
  writeFileSync(resolve(OUT, "identifiers.json"), JSON.stringify(out, null, 1));
});

// --- English locale spot-check --------------------------------------------

test("dump en_strict_04", async ({ page }) => {
  test.slow();
  const s = SCENARIOS.find((x) => x.key === "strict_04")!;
  await seed(page, s);
  await page.goto("/en/student");
  await page.getByLabel(en.student.idLabel).fill(s.studentId);
  await page
    .getByRole("navigation", { name: /steps/i })
    .getByRole("link", { name: /^3\./ })
    .click();
  await page.waitForURL("**/en/result");
  await expect(page.getByTestId("unmatched-risk")).toBeVisible({
    timeout: 120_000,
  });
  await openDisclosures(page);
  writeFileSync(
    resolve(OUT, "en_strict_04.json"),
    JSON.stringify(
      {
        risk: (await page.getByTestId("unmatched-risk").innerText()).trim(),
        // The attention alert is gone (§9b item 5); the headline is what the
        // English side-by-side compares now.
        chance: (
          await page.getByTestId("assignment-chance").innerText()
        ).trim(),
        headline: (
          await page.getByTestId("result-headline").innerText()
        ).trim(),
        podium: await page.getByTestId("outcome-item").allInnerTexts(),
        family: await page.getByTestId("family-table").innerText(),
        detail: await page.getByTestId("detail-table").innerText(),
      },
      null,
      1,
    ),
  );
});
