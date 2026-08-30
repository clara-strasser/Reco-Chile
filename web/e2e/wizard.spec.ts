import { expect, test } from "@playwright/test";

import en from "../messages/en.json";
import es from "../messages/es.json";

/**
 * Phase 2 exit gate (MIGRATION.md §7): "`pnpm e2e` green; navigating
 * `/es/student` → `/es/list` works with the guard", plus the smoke test that
 * "loads step 1 in both locales". Replaces the scaffold's `smoke.spec.ts`,
 * which only asserted that `/` returned 200.
 *
 * Expected copy is read from `messages/{es,en}.json` rather than frozen here, so
 * these stay true when Phase 3 rewords a sentence — what is under test is the
 * routing, the guard and the store, not the wording. `components/wizard/
 * steps.test.ts` is what fails if an id disappears from a catalogue.
 */

/** A valid RUN — body 12345678, modulo-11 check digit 5. */
const VALID_RUN = "12.345.678-5";
/** Same body, wrong verifier: right shape, rejected by the check digit. */
const BAD_CHECK_DIGIT = "12.345.678-4";

const MESSAGES = { es, en } as const;

/** The string `messages/<locale>.json` holds for a dotted message id. */
function copy(locale: keyof typeof MESSAGES, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      MESSAGES[locale],
    );

  if (typeof value !== "string") {
    throw new Error(`messages/${locale}.json has no string at "${key}"`);
  }
  return value;
}

function stepHeading(locale: keyof typeof MESSAGES, key: string) {
  return { level: 2 as const, name: copy(locale, key) };
}

test.describe("wizard shell", () => {
  test("step 1 loads in Spanish", async ({ page }) => {
    const response = await page.goto("/es/student");

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/es\/student$/);
    await expect(
      page.getByRole("heading", stepHeading("es", "student.title")),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("step 1 loads in English", async ({ page }) => {
    await page.goto("/en/student");

    await expect(
      page.getByRole("heading", stepHeading("en", "student.title")),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    // The locale switch is a real switch, not the same string twice.
    expect(copy("en", "student.title")).not.toBe(copy("es", "student.title"));
  });

  test("the locale switcher keeps the current step", async ({ page }) => {
    await page.goto("/es/student");

    const switcher = page.getByRole("navigation", {
      name: copy("es", "app.languageLabel"),
    });
    await switcher
      .getByRole("link", { name: copy("es", "app.language.en") })
      .click();

    // Same step, other language: `usePathname` from `@/i18n/navigation` is
    // locale-free, so switching must not send the family back to the start.
    await page.waitForURL("**/en/student");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", stepHeading("en", "student.title")),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: copy("en", "app.languageLabel") })
      .getByRole("link", { name: copy("en", "app.language.es") })
      .click();
    await page.waitForURL("**/es/student");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  test("the guard sends a locked step back to step 1", async ({ page }) => {
    // The RUN/IPE is never persisted (MIGRATION.md §4.2), so on a cold load
    // steps 2-4 are locked however the URL was reached.
    for (const locked of ["list", "result", "improve"]) {
      await page.goto(`/es/${locked}`);
      await page.waitForURL("**/es/student");
      await expect(
        page.getByRole("heading", stepHeading("es", "student.title")),
      ).toBeVisible();
    }
  });

  test("a valid RUN enables Continue and opens step 2", async ({ page }) => {
    await page.goto("/es/student");

    const continueButton = page.getByTestId("wizard-continue");
    const feedback = page.getByTestId("student-id-feedback");
    await expect(continueButton).toBeDisabled();
    await expect(feedback).toHaveAttribute("data-state", "empty");

    const input = page.getByLabel(copy("es", "student.idLabel"));

    await input.fill("no es un RUN");
    await expect(feedback).toHaveAttribute("data-state", "invalid");
    await expect(feedback).toHaveText(copy("es", "errors.invalidStudentId"));
    await expect(continueButton).toBeDisabled();

    await input.fill(BAD_CHECK_DIGIT);
    await expect(feedback).toHaveText(
      copy("es", "errors.invalidRunCheckDigit"),
    );
    await expect(continueButton).toBeDisabled();

    await input.fill(VALID_RUN);
    await expect(feedback).toHaveAttribute("data-state", "valid");
    await expect(continueButton).toBeEnabled();

    await continueButton.click();
    await page.waitForURL("**/es/list");
    await expect(
      page.getByRole("heading", stepHeading("es", "list.title")),
    ).toBeVisible();
  });

  test("step 2 renders live data from /meta", async ({ page }) => {
    await page.goto("/es/student");
    await page.getByLabel(copy("es", "student.idLabel")).fill(VALID_RUN);
    await page.getByTestId("wizard-continue").click();
    await page.waitForURL("**/es/list");

    // Proves the whole data path: FastAPI -> fetchMeta() on the server ->
    // MetaProvider -> useMeta() in the client tree. Chile has 16 regions, so the
    // count is a positive number for any correctly loaded calibration file.
    const regions = page.getByTestId("meta-regions");
    await expect(regions).toBeVisible();
    expect(Number(await regions.innerText())).toBeGreaterThan(0);
  });

  test("step 2 keeps its own gate closed while the list is empty", async ({
    page,
  }) => {
    await page.goto("/es/student");
    await page.getByLabel(copy("es", "student.idLabel")).fill(VALID_RUN);
    await page.getByTestId("wizard-continue").click();
    await page.waitForURL("**/es/list");

    // Entering step 2 does not unlock step 3: that needs at least one wish
    // (MIGRATION.md §4.1), which Phase 3 adds.
    await expect(page.getByTestId("wizard-continue")).toBeDisabled();
    await expect(
      page.getByRole("navigation").getByRole("link", {
        name: new RegExp(escapeRegExp(copy("es", "steps.result"))),
      }),
    ).toHaveCount(0);
  });

  test("the stepper unlocks step 2 only once step 1 is valid", async ({
    page,
  }) => {
    await page.goto("/es/student");

    const stepTwoLink = page.getByRole("navigation").getByRole("link", {
      name: new RegExp(escapeRegExp(copy("es", "steps.list"))),
    });
    await expect(stepTwoLink).toHaveCount(0);

    await page.getByLabel(copy("es", "student.idLabel")).fill(VALID_RUN);
    await expect(stepTwoLink.first()).toBeVisible();

    await stepTwoLink.first().click();
    await page.waitForURL("**/es/list");
  });

  test("Back returns from step 2 to step 1", async ({ page }) => {
    await page.goto("/es/student");
    await page.getByLabel(copy("es", "student.idLabel")).fill(VALID_RUN);
    await page.getByTestId("wizard-continue").click();
    await page.waitForURL("**/es/list");

    await page.getByTestId("wizard-back").click();
    await page.waitForURL("**/es/student");
    await expect(
      page.getByRole("heading", stepHeading("es", "student.title")),
    ).toBeVisible();
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
