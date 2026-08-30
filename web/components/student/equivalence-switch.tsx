"use client";

import { InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useWizardStore } from "@/lib/store/wizard";

const SWITCH_ID = "use-equivalence-classes";
const HELP_ID = "use-equivalence-classes-help";

/**
 * The prototype's `st.toggle(t("I have not yet decided the exact order between
 * some programs"))` plus the `st.info` it reveals (`app.py` lines 211-224).
 *
 * Streamlit shows the toggle's `help=` as a hover tooltip; here it is a
 * permanently visible line under the control, because the sentence is a caveat
 * about the official application ("choose the order it genuinely prefers before
 * submitting") that should not depend on hovering a question mark.
 *
 * The mode badge names the two states in the family's language and gives the
 * switch a visible current-value readout — a switch alone only reads as
 * on/off. It reuses the prototype's own `Strict ranking` / `Equivalence
 * classes` wording.
 *
 * Flipping the switch is the §4.2 invalidation rule "useEquivalenceClasses
 * toggles → wishes kept, groups reset, simulation invalidated"; the store owns
 * it, this component only calls the action.
 */
export function EquivalenceSwitch() {
  const t = useTranslations("student.ties");

  const useEquivalenceClasses = useWizardStore(
    (state) => state.useEquivalenceClasses,
  );
  const setUseEquivalenceClasses = useWizardStore(
    (state) => state.setUseEquivalenceClasses,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Switch
          id={SWITCH_ID}
          checked={useEquivalenceClasses}
          onCheckedChange={setUseEquivalenceClasses}
          aria-describedby={HELP_ID}
          data-testid="equivalence-switch"
          className="mt-0.5"
        />
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={SWITCH_ID} className="font-medium">
              {t("label")}
            </Label>
            <Badge
              variant={useEquivalenceClasses ? "default" : "outline"}
              data-testid="equivalence-mode"
            >
              {useEquivalenceClasses ? t("equivalenceLabel") : t("strictLabel")}
            </Badge>
          </div>
          <p id={HELP_ID} className="text-sm text-muted-foreground">
            {t("help")}
          </p>
        </div>
      </div>

      {useEquivalenceClasses ? (
        <Alert data-testid="equivalence-info">
          <InfoIcon aria-hidden="true" />
          <AlertDescription>{t("info")}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
