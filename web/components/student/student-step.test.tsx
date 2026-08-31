import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import es from "@/messages/es";
import { useWizardStore } from "@/lib/store/wizard";

import { StudentStep } from "./student-step";

// The step renders outside the App Router here, so the router hooks its shared
// frame (`components/wizard/step-page.tsx`) uses have no context to read. Only
// the hooks are stubbed; the component tree under test is the real one.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/es/student",
}));

// `@/i18n/navigation` builds its `Link` with next-intl's client navigation,
// which imports `next/navigation` through its own package and cannot be
// resolved outside a Next.js build. The stub keeps the href the component
// asks for; adding the `/[locale]` prefix is next-intl's job and is asserted
// end-to-end in `e2e/student.spec.ts` instead.
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/student",
}));

/**
 * Step 1's wiring: every control writes the store slice MIGRATION.md §4.2 says
 * it owns, and the identifier's live pre-check picks the right message.
 *
 * The Spanish catalogue is used verbatim — the assertions compare against
 * `messages/es/*.json`, never against a string frozen here, so rewording the
 * copy does not fail a test that is about behaviour. The pre-check itself
 * (RUN/IPE rules against the golden fixtures) is covered in
 * `lib/validation/student-id.test.ts`.
 *
 * The step's own gate is deliberately absent: Continue lives in `WizardNav`
 * above this component, and `lib/store/wizard.test.ts` owns the gate rules.
 */

function renderStep() {
  return render(
    <NextIntlClientProvider locale="es" messages={es}>
      <StudentStep />
    </NextIntlClientProvider>,
  );
}

const copy = es.student;

function feedback() {
  return screen.getByTestId("student-id-feedback");
}

/** `student.idValid` with its `{kind}` placeholder filled in. */
function validCopy(kind: "RUN" | "IPE") {
  return copy.idValid.replace("{kind}", kind);
}

beforeEach(() => {
  window.sessionStorage.clear();
  useWizardStore.getState().reset();
});

describe("StudentStep — identifier field", () => {
  it("starts empty, with the hint and no error styling", () => {
    renderStep();

    const input = screen.getByLabelText(copy.idLabel);
    expect(input).toHaveValue("");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(feedback()).toHaveAttribute("data-state", "empty");
    expect(feedback()).toHaveTextContent(copy.idRequiredHint);
  });

  it("links the feedback and the help text to the input", () => {
    renderStep();

    const input = screen.getByLabelText(copy.idLabel);
    const describedBy = (input.getAttribute("aria-describedby") ?? "").split(
      " ",
    );

    expect(describedBy).toContain("student-id-feedback");
    expect(describedBy.length).toBe(2);
    for (const id of describedBy) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it("keeps the identifier out of autofill and spellcheck (§4.5)", () => {
    renderStep();

    const input = screen.getByLabelText(copy.idLabel);
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("spellcheck", "false");
    expect(input).toHaveAttribute("placeholder", copy.idPlaceholder);
  });

  it("rejects a value that is neither a RUN nor an IPE", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.type(screen.getByLabelText(copy.idLabel), "no es un RUN");

    expect(feedback()).toHaveAttribute("data-state", "invalid");
    expect(feedback()).toHaveTextContent(es.errors.invalidStudentId);
    expect(screen.getByLabelText(copy.idLabel)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("names the check digit when only the verifier is wrong", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.type(screen.getByLabelText(copy.idLabel), "12.345.678-4");

    expect(feedback()).toHaveAttribute("data-state", "invalid");
    expect(feedback()).toHaveTextContent(es.errors.invalidRunCheckDigit);
  });

  it("confirms a valid RUN and names the kind", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.type(screen.getByLabelText(copy.idLabel), "12.345.678-5");

    expect(feedback()).toHaveAttribute("data-state", "valid");
    expect(feedback()).toHaveTextContent(validCopy("RUN"));
    expect(useWizardStore.getState().studentId).toBe("12.345.678-5");
  });

  it("confirms a valid IPE and names the kind", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.type(screen.getByLabelText(copy.idLabel), "100200300-4");

    expect(feedback()).toHaveAttribute("data-state", "valid");
    expect(feedback()).toHaveTextContent(validCopy("IPE"));
  });
});

describe("StudentStep — the welcome answer (§9b item 2)", () => {
  it("no longer asks the question — the welcome page does", () => {
    renderStep();

    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(useWizardStore.getState().listExists).toBeNull();
    // With no answer the note has nothing to report; the step guard is what
    // keeps this state off the screen in the running app.
    expect(screen.queryByTestId("list-choice-note")).toBeNull();
  });

  it("reports the answer with the label of the button that was pressed", () => {
    useWizardStore.getState().setListExists(false);
    renderStep();

    expect(screen.getByTestId("list-choice-note")).toHaveTextContent(
      es.app.welcome.no,
    );
    expect(screen.getByTestId("list-choice-note")).not.toHaveTextContent(
      es.app.welcome.yes,
    );
  });

  it("links back to the welcome page to change it", () => {
    useWizardStore.getState().setListExists(true);
    renderStep();

    const change = screen.getByTestId("list-choice-change");
    expect(change).toHaveTextContent(copy.listChoice.change);
    // The welcome page; `@/i18n/navigation` adds the `/es` prefix at runtime.
    expect(change).toHaveAttribute("href", "/");
    expect(screen.getByTestId("list-choice-note")).toHaveTextContent(
      es.app.welcome.yes,
    );
  });

  it("shows the preference-group alert only while ties mode is on", async () => {
    const user = userEvent.setup();
    renderStep();

    const toggle = screen.getByRole("switch", { name: copy.ties.label });
    expect(screen.queryByTestId("equivalence-info")).toBeNull();
    expect(screen.getByTestId("equivalence-mode")).toHaveTextContent(
      copy.ties.strictLabel,
    );

    await user.click(toggle);

    expect(useWizardStore.getState().useEquivalenceClasses).toBe(true);
    expect(screen.getByTestId("equivalence-info")).toHaveTextContent(
      copy.ties.info,
    );
    expect(screen.getByTestId("equivalence-mode")).toHaveTextContent(
      copy.ties.equivalenceLabel,
    );

    await user.click(toggle);
    expect(screen.queryByTestId("equivalence-info")).toBeNull();
  });

  it("describes the switch with its planning caveat", () => {
    renderStep();

    const toggle = screen.getByRole("switch", { name: copy.ties.label });
    const describedBy = toggle.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      copy.ties.help,
    );
  });
});

describe("StudentStep — standing copy", () => {
  it("opens with the research-tool disclaimer, above the identifier", () => {
    renderStep();

    const disclaimer = screen.getByTestId("student-disclaimer");
    expect(disclaimer).toHaveTextContent(copy.disclaimer);
    // "Prominently at the top" (§9b item 2): before the RUN/IPE field in the
    // document order, which is also the reading and the tab order.
    const input = screen.getByLabelText(copy.idLabel);
    expect(
      disclaimer.compareDocumentPosition(input) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps jargon out of the identifier copy (§9b item 3)", () => {
    renderStep();

    // No "modulo-11 check digit", no "MTB", no OpenStreetMap on this step.
    for (const text of [copy.idHelp, copy.why.body, copy.why.privacy]) {
      expect(text).not.toMatch(/módulo|modulo|MTB|OpenStreetMap/i);
    }
    expect(copy.privacyNote).not.toMatch(/OpenStreetMap/i);
  });

  it("keeps the estimate caveat available and the privacy note visible", () => {
    renderStep();

    expect(screen.getByTestId("about-estimate-trigger")).toHaveTextContent(
      es.app.aboutEstimate.title,
    );
    expect(screen.getByTestId("student-privacy-note")).toHaveTextContent(
      copy.privacyNote,
    );
    expect(screen.getByTestId("student-why-trigger")).toHaveTextContent(
      copy.why.title,
    );
  });
});
