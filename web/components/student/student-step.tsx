"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StepPage } from "@/components/wizard/step-page";

import { AboutEstimate } from "./about-estimate";
import { EquivalenceSwitch } from "./equivalence-switch";
import { ListChoiceNote } from "./list-choice-note";
import { PrivacyNote } from "./privacy-note";
import { ResearchDisclaimer } from "./research-disclaimer";
import { StudentIdField } from "./student-id-field";

/**
 * Step 1 — identify the student (MIGRATION.md §4.1 row 1; `app.py` lines
 * 176-230).
 *
 * Since MIGRATION.md §9b the step opens with the research-tool disclaimer —
 * the family reads what this is before typing an identifier — and the
 * "is the list already established?" radio is gone: the welcome page asks that
 * question now, and only the answer plus a link back to change it remain.
 *
 * So: the disclaimer, the identifier with its "why do we ask" popover, then
 * the current situation — the welcome answer and whether the order is still
 * open. Below them the "about this estimate" caveat and the privacy statement,
 * both closing rather than interrupting the form.
 *
 * Continue is *not* wired here. The gate ("RUN/IPE passes the client
 * pre-check") lives in the store, `use-wizard-gating.ts` binds it to the route
 * and `WizardNav` renders the button — this step only writes to the store, so
 * the answer stays the same whether the family arrived by Continue, by the
 * stepper or by a deep link.
 *
 * Single column throughout: the locale layout owns the centred max-width
 * column, and everything here stacks, so the phone layout is the desktop one
 * (§7 Phase 3, "mobile layout single column ≤ 640 px").
 */
export function StudentStep() {
  const t = useTranslations("student");

  return (
    <StepPage slug="student">
      <ResearchDisclaimer />

      <Card>
        <CardContent>
          <StudentIdField />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("situationTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ListChoiceNote />
          <Separator />
          <EquivalenceSwitch />
        </CardContent>
      </Card>

      <AboutEstimate />
      <PrivacyNote />
    </StepPage>
  );
}
