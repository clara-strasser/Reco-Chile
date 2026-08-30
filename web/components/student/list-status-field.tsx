"use client";

import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useWizardStore } from "@/lib/store/wizard";

/** The two answers, in the prototype's order. Also the `student.listStatus.*`
 *  leaf ids of their labels. */
const ANSWERS = ["yes", "no"] as const;

const GROUP_LABEL_ID = "list-status-label";

/**
 * The prototype's `st.radio(t("Is the student's wish list already
 * established?"))` (`app.py` lines 199-209).
 *
 * Streamlit keeps the two English option strings as the internal values and
 * translates only the display (`format_option_label`); the store models the
 * same choice as `listExists: boolean | null`, so those strings disappear and
 * the radio carries `"yes"` / `"no"` values whose labels come from
 * `student.listStatus.*`.
 *
 * `null` — nothing answered yet — is a real state: step 2 shows the filter
 * panel only for "No, help me build it", so it has to tell "not answered" from
 * "answered No". Step 1's Continue gate does not depend on the answer either
 * way (§4.1: only the RUN/IPE pre-check), so nothing is blocked by leaving it
 * open.
 */
export function ListStatusField() {
  const t = useTranslations("student.listStatus");

  const listExists = useWizardStore((state) => state.listExists);
  const setListExists = useWizardStore((state) => state.setListExists);

  return (
    <div className="flex flex-col gap-3">
      {/* Not a <label>: the question names the group, not one control. */}
      <span id={GROUP_LABEL_ID} className="text-sm font-medium">
        {t("label")}
      </span>
      <RadioGroup
        aria-labelledby={GROUP_LABEL_ID}
        value={listExists === null ? undefined : listExists ? "yes" : "no"}
        onValueChange={(next) => setListExists(next === "yes")}
        data-testid="list-status"
        // `horizontal=True` in the prototype; one column below 640 px so the
        // two long option labels do not truncate on a phone (§7 Phase 3).
        className="gap-3 sm:grid-cols-2"
      >
        {ANSWERS.map((answer) => (
          <div key={answer} className="flex items-center gap-2">
            <RadioGroupItem id={`list-status-${answer}`} value={answer} />
            <Label htmlFor={`list-status-${answer}`} className="font-normal">
              {t(answer)}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
