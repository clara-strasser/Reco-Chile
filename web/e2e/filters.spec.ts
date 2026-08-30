import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import es from "../messages/es";

/**
 * Phase 3, step 2 — the program-finding half: filter panel, matching count,
 * "kept outside filters" note and the server-searched combobox
 * (MIGRATION.md §4.1 row 2; `app.py` 226-443).
 *
 * The assertions compare the UI against `GET /api/programs` with the *same*
 * parameters rather than against numbers frozen here. That is the property
 * that actually matters: the panel, the caption and the combobox must all be
 * showing what `program_matches_filters` says, not a client-side approximation
 * of it (§0 — the engine is the only source of truth). It also keeps the test
 * true when the calibration CSVs change.
 */

/** A valid RUN — body 12345678, modulo-11 check digit 5. */
const VALID_RUN = "12.345.678-5";

/** A region that actually has technical-vocational programs, so the specialty
 *  filter has something to narrow. Verified against the API in the test. */
const REGION = "Región de Los Ríos";
/** Wire value; the UI shows the `enums.specialty` translation of it. */
const SPECIALTY = "Food services";
/** Any region other than {@link REGION} — used for the preserved-wish note. */
const OTHER_REGION = "Región de Arica y Parinacota";

const filtersCopy = es.filters as unknown as {
  fields: Record<string, { label: string }>;
};
const enums = es.enums as unknown as Record<string, Record<string, string>>;
/** Owned by the wish-card half of step 2; read, never duplicated. */
const wishesCopy = es.wishes as unknown as {
  card: { detailsTrigger: string };
};

/** `total_matched` the API reports for a set of query parameters. */
async function apiTotal(
  request: APIRequestContext,
  params: Record<string, string | string[]>,
): Promise<number> {
  return (await apiPrograms(request, params)).total_matched;
}

async function apiPrograms(
  request: APIRequestContext,
  params: Record<string, string | string[]>,
): Promise<{ total_matched: number; items: Array<{ program_id: string }> }> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      search.append(key, item);
    }
  }
  const response = await request.get(`/api/programs?${search.toString()}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as {
    total_matched: number;
    items: Array<{ program_id: string }>;
  };
}

/** Step 1 with a valid RUN and "No — help me build it", landing on step 2. */
async function openBuilder(page: Page) {
  await page.goto("/es/student");
  await page.getByLabel(es.student.idLabel).fill(VALID_RUN);
  await page.locator("#list-status-no").click();
  await page.getByTestId("wizard-continue").click();
  await page.waitForURL("**/es/list");
  await expect(page.getByTestId("filter-panel")).toBeVisible();
}

/** Radix `Select`: open the trigger, pick the option by its visible name. */
async function chooseRegion(page: Page, region: string) {
  await page.getByTestId("filter-region").click();
  await page.getByRole("option", { name: region, exact: true }).click();
}

/** The caption's machine-readable count; it only exists once something is
 *  filtered, which is the prototype's own rule. */
function matchCount(page: Page) {
  return page.getByTestId("filter-match-count");
}

async function expectCount(page: Page, expected: number) {
  await expect(matchCount(page)).toHaveAttribute(
    "data-count",
    String(expected),
  );
}

test.describe("step 2 — filters and program search", () => {
  test("the matching count follows the filters, and the combobox agrees", async ({
    page,
    request,
  }) => {
    const regionTotal = await apiTotal(request, { region: REGION });
    const specializedTotal = await apiTotal(request, {
      region: REGION,
      track: "Specialized",
    });
    const specialtyMatches = await apiPrograms(request, {
      region: REGION,
      track: "Specialized",
      specialty_sector: SPECIALTY,
      limit: "200",
    });

    // The scenario is only meaningful if each step actually narrows.
    expect(specialtyMatches.total_matched).toBeGreaterThan(0);
    expect(specialtyMatches.total_matched).toBeLessThan(specializedTotal);
    expect(specializedTotal).toBeLessThan(regionTotal);

    await openBuilder(page);

    // Nothing filtered yet: the prototype prints no caption at all.
    await expect(matchCount(page)).toHaveCount(0);

    await chooseRegion(page, REGION);
    await expect(matchCount(page)).toBeVisible();
    await expectCount(page, regionTotal);
    await expect(matchCount(page)).toContainText(REGION);

    await page.getByTestId("filter-track-specialized").click();
    await expectCount(page, specializedTotal);

    // The specialty select only exists once "Specialized" is ticked.
    await page.getByTestId("filter-more-trigger").click();
    const specialtySelect = page.getByTestId("filter-specialtySectors");
    await expect(specialtySelect).toBeVisible();
    await expect(specialtySelect).toHaveAttribute("data-selected-count", "0");

    await specialtySelect.click();
    await page
      .getByRole("option", { name: enums.specialty[SPECIALTY], exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(specialtySelect).toHaveAttribute("data-selected-count", "1");

    await expectCount(page, specialtyMatches.total_matched);

    // The combobox is fed by the same endpoint with the same parameters, so it
    // must list exactly the programs the API matched — no more, no fewer.
    await page.getByTestId("program-search-trigger").click();
    const options = page.getByTestId("program-search-option");
    await expect(options).toHaveCount(specialtyMatches.total_matched);

    const listed = await options.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-program-id")),
    );
    expect([...listed].sort()).toEqual(
      specialtyMatches.items.map((item) => item.program_id).sort(),
    );
  });

  test("unticking Specialized drops the specialty filter with it", async ({
    page,
    request,
  }) => {
    const regionTotal = await apiTotal(request, { region: REGION });

    await openBuilder(page);
    await chooseRegion(page, REGION);
    await page.getByTestId("filter-track-specialized").click();
    await page.getByTestId("filter-more-trigger").click();

    await page.getByTestId("filter-specialtySectors").click();
    await page
      .getByRole("option", { name: enums.specialty[SPECIALTY], exact: true })
      .click();
    await page.keyboard.press("Escape");

    // A specialty selection that survived its track would keep filtering
    // invisibly, because the select itself is gone.
    await page.getByTestId("filter-track-specialized").click();
    await expect(page.getByTestId("filter-specialtySectors")).toHaveCount(0);
    await expectCount(page, regionTotal);
  });

  test("an already-selected program outside the filters is kept and counted", async ({
    page,
    request,
  }) => {
    const other = await apiPrograms(request, {
      region: OTHER_REGION,
      limit: "1",
    });
    const kept = other.items[0].program_id;
    const regionTotal = await apiTotal(request, { region: REGION });

    await openBuilder(page);

    // Add a program from another region while nothing is filtered.
    await page.getByTestId("program-search-trigger").click();
    await page
      .locator(
        `[data-testid="program-search-option"][data-program-id="${kept}"]`,
      )
      .click();
    await page.getByTestId("program-search-add").click();
    await expect(page.getByTestId("wish-card")).toHaveCount(1);

    // Filtering to another region must not remove it — it is reported instead.
    await chooseRegion(page, REGION);
    await expectCount(page, regionTotal);
    await expect(matchCount(page)).toHaveAttribute("data-preserved", "1");
    await expect(page.getByTestId("wish-card")).toHaveCount(1);
  });

  test("the program details list shows the prototype's ten rows", async ({
    page,
  }) => {
    await openBuilder(page);

    await page.getByTestId("program-search-trigger").click();
    await page.getByTestId("program-search-option").first().click();
    await page.getByTestId("program-search-add").click();

    await page
      .getByTestId("wish-card")
      .first()
      .getByRole("button", {
        name: new RegExp(escapeRegExp(wishesCopy.card.detailsTrigger)),
      })
      .click();
    const details = page.getByTestId("program-details");
    await expect(details).toHaveAttribute("data-state", "ready");
    await expect(page.getByTestId("program-details-row")).toHaveCount(10);
    // Enumerated values are shown in Spanish, never as the English wire code.
    await expect(
      page
        .getByTestId("program-details-row")
        .filter({ hasText: "PIE" })
        .first(),
    ).toContainText(/Con PIE|Sin PIE|Sin información/);
  });

  test("the filter panel is keyboard operable", async ({ page }) => {
    await openBuilder(page);
    await page.getByTestId("filter-more-trigger").click();

    const gender = page.getByTestId("filter-genders");
    await expect(gender).toHaveAccessibleName(
      new RegExp(escapeRegExp(filtersCopy.fields.gender.label)),
    );

    await gender.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(gender).toHaveAttribute("data-selected-count", "1");
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
