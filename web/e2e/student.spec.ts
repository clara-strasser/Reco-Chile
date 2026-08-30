import { expect, test, type Page } from "@playwright/test";

import en from "../messages/en";
import es from "../messages/es";

/**
 * Phase 3, step 1 — the Student step (MIGRATION.md §4.1 row 1).
 *
 * `wizard.spec.ts` already covers the shell (routing, guard, stepper, locale
 * switch). What is under test here is the step itself: the live RUN/IPE
 * pre-check and the two mode controls, including which of them survives a
 * reload — the privacy line of §4.2/§4.5 that says the identifier is
 * memory-only while the family's mode choices are not.
 *
 * Expected copy is read from `messages/{es,en}/*.json`, never frozen here, so a
 * reworded sentence does not fail a test that is about behaviour.
 */

/** `sessionStorage` key of the zustand store (`WIZARD_PERSIST_KEY`). Written
 *  out rather than imported: the Playwright runner does not resolve the `@/`
 *  alias the store module uses. */
const PERSIST_KEY = "reco-chile.wizard";

/** A valid RUN — body 12345678, modulo-11 check digit 5. */
const VALID_RUN = "12.345.678-5";
/** Same body, wrong verifier: right shape, rejected by the check digit. */
const BAD_CHECK_DIGIT = "12.345.678-4";
/** A valid IPE — nine-digit body plus its numeric verifier. */
const VALID_IPE = "100200300-4";

const MESSAGES = { es, en } as const;

type Locale = keyof typeof MESSAGES;

/** The string `messages/<locale>/*.json` holds for a dotted message id. */
function copy(locale: Locale, key: string): string {
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
    throw new Error(`messages/${locale} has no string at "${key}"`);
  }
  return value;
}

/** `student.idValid` with its `{kind}` placeholder filled in. */
function validCopy(locale: Locale, kind: "RUN" | "IPE"): string {
  return copy(locale, "student.idValid").replace("{kind}", kind);
}

function identifierInput(page: Page, locale: Locale = "es") {
  return page.getByLabel(copy(locale, "student.idLabel"));
}

function feedback(page: Page) {
  return page.getByTestId("student-id-feedback");
}

function continueButton(page: Page) {
  return page.getByTestId("wizard-continue");
}

/** Whatever the store has written to `sessionStorage`, as raw text. */
function persisted(page: Page): Promise<string | null> {
  return page.evaluate(
    (key) => window.sessionStorage.getItem(key),
    PERSIST_KEY,
  );
}

test.describe("step 1 — identify the student", () => {
  test("a wrong check digit shows the red helper and keeps Continue disabled", async ({
    page,
  }) => {
    await page.goto("/es/student");

    await expect(feedback(page)).toHaveAttribute("data-state", "empty");
    await expect(feedback(page)).toHaveText(
      copy("es", "student.idRequiredHint"),
    );
    await expect(continueButton(page)).toBeDisabled();

    await identifierInput(page).fill(BAD_CHECK_DIGIT);

    // The shape is a RUN, so the message is the specific one about the
    // verifier — not the generic "neither a RUN nor an IPE".
    await expect(feedback(page)).toHaveAttribute("data-state", "invalid");
    await expect(feedback(page)).toHaveText(
      copy("es", "errors.invalidRunCheckDigit"),
    );
    await expect(feedback(page)).toHaveClass(/text-destructive/);
    await expect(identifierInput(page)).toHaveAttribute("aria-invalid", "true");
    await expect(continueButton(page)).toBeDisabled();

    // And the step guard still refuses the next route.
    await page.goto("/es/list");
    await page.waitForURL("**/es/student");
  });

  test("a valid IPE enables Continue", async ({ page }) => {
    await page.goto("/es/student");

    await identifierInput(page).fill(VALID_IPE);

    await expect(feedback(page)).toHaveAttribute("data-state", "valid");
    await expect(feedback(page)).toHaveText(validCopy("es", "IPE"));
    await expect(continueButton(page)).toBeEnabled();

    // A RUN is recognised as the other kind, from the same field.
    await identifierInput(page).fill(VALID_RUN);
    await expect(feedback(page)).toHaveText(validCopy("es", "RUN"));
    await expect(continueButton(page)).toBeEnabled();
  });

  test("the why-do-we-ask popover carries both prototype paragraphs", async ({
    page,
  }) => {
    await page.goto("/es/student");

    await page.getByTestId("student-why-trigger").click();

    const content = page.getByTestId("student-why-content");
    await expect(content).toBeVisible();
    await expect(content).toContainText(copy("es", "student.why.body"));
    await expect(content).toContainText(copy("es", "student.why.privacy"));
  });

  test("the estimate caveat is collapsed until it is opened", async ({
    page,
  }) => {
    await page.goto("/es/student");

    const trigger = page.getByTestId("about-estimate-trigger");
    await expect(trigger).toHaveText(copy("es", "app.aboutEstimate.title"));
    await expect(page.getByTestId("about-estimate-content")).toBeHidden();

    await trigger.click();
    await expect(page.getByTestId("about-estimate-content")).toContainText(
      copy("es", "app.aboutEstimate.body"),
    );
  });

  test("the privacy note is visible without any interaction", async ({
    page,
  }) => {
    await page.goto("/es/student");

    await expect(page.getByTestId("student-privacy-note")).toHaveText(
      copy("es", "student.privacyNote"),
    );
  });
});

test.describe("step 1 — mode controls", () => {
  test("turning the ties switch on reveals the preference-group alert", async ({
    page,
  }) => {
    await page.goto("/es/student");

    const toggle = page.getByRole("switch", {
      name: copy("es", "student.ties.label"),
    });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("equivalence-info")).toHaveCount(0);
    await expect(page.getByTestId("equivalence-mode")).toHaveText(
      copy("es", "student.ties.strictLabel"),
    );

    await toggle.click();

    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("equivalence-info")).toHaveText(
      copy("es", "student.ties.info"),
    );
    await expect(page.getByTestId("equivalence-mode")).toHaveText(
      copy("es", "student.ties.equivalenceLabel"),
    );

    await toggle.click();
    await expect(page.getByTestId("equivalence-info")).toHaveCount(0);
  });

  test("the switch is operable from the keyboard and keeps its help text", async ({
    page,
  }) => {
    await page.goto("/es/student");

    const toggle = page.getByRole("switch", {
      name: copy("es", "student.ties.label"),
    });
    await toggle.focus();
    await page.keyboard.press("Space");

    await expect(toggle).toHaveAttribute("aria-checked", "true");

    const helpId = await toggle.getAttribute("aria-describedby");
    expect(helpId).toBeTruthy();
    await expect(page.locator(`#${helpId}`)).toHaveText(
      copy("es", "student.ties.help"),
    );
  });

  test("the list-status answer survives a reload; the RUN/IPE does not", async ({
    page,
  }) => {
    await page.goto("/es/student");

    await identifierInput(page).fill(VALID_RUN);
    await page
      .getByRole("radio", { name: copy("es", "student.listStatus.no") })
      .click();
    await page
      .getByRole("switch", { name: copy("es", "student.ties.label") })
      .click();
    await expect(continueButton(page)).toBeEnabled();

    // Privacy (§4.2, §4.5): the mode choices are persisted, the identifier is
    // never written anywhere.
    const stored = await persisted(page);
    expect(stored).toContain('"listExists":false');
    expect(stored).not.toContain("12345678");
    expect(stored).not.toContain(VALID_RUN);
    expect(page.url()).not.toContain("12");

    await page.reload();

    await expect(
      page.getByRole("radio", { name: copy("es", "student.listStatus.no") }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("equivalence-info")).toBeVisible();

    await expect(identifierInput(page)).toHaveValue("");
    await expect(feedback(page)).toHaveAttribute("data-state", "empty");
    await expect(continueButton(page)).toBeDisabled();
  });
});

test.describe("step 1 — English", () => {
  test("renders the same controls in the second locale", async ({ page }) => {
    await page.goto("/en/student");

    await expect(
      page.getByRole("radiogroup", {
        name: copy("en", "student.listStatus.label"),
      }),
    ).toBeVisible();

    await identifierInput(page, "en").fill(VALID_IPE);
    await expect(feedback(page)).toHaveText(validCopy("en", "IPE"));
    await expect(continueButton(page)).toBeEnabled();

    // The locale switch is a real switch, not the same string twice.
    expect(validCopy("en", "IPE")).not.toBe(validCopy("es", "IPE"));
  });
});
