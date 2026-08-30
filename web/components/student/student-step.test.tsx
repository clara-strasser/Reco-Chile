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

describe("StudentStep — mode controls", () => {
  it("labels the list-status question as the radio group", () => {
    renderStep();

    const group = screen.getByRole("radiogroup", {
      name: copy.listStatus.label,
    });
    expect(group).toBeInTheDocument();
    expect(useWizardStore.getState().listExists).toBeNull();
  });

  it("writes listExists for either answer", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole("radio", { name: copy.listStatus.no }));
    expect(useWizardStore.getState().listExists).toBe(false);

    await user.click(screen.getByRole("radio", { name: copy.listStatus.yes }));
    expect(useWizardStore.getState().listExists).toBe(true);
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
