"use client";

import { Card, CardContent } from "@/components/ui/card";
import { StepPage } from "@/components/wizard/step-page";

import { PrivacyNote } from "./privacy-note";
import { StudentIdField } from "./student-id-field";

/**
 * Step 1 — identify the student (MIGRATION.md §4.1 row 1; `app.py` lines
 * 176-230).
 *
 * The research-tool disclaimer moved to its own "Before we continue" page
 * (`DisclaimerScreen`) ahead of the welcome page's Yes/No choice, so this step
 * no longer repeats it. The "is the list already established?" radio is gone
 * too: the welcome page asks that question and owns the answer. The "Your
 * current situation" note that used to echo that answer back (with a link to
 * change it) is gone as well — the header's brand link already returns to the
 * welcome page from anywhere. The "I have not yet decided the exact order"
 * ties toggle moved to step 2 (`EquivalenceSwitch` in `components/list/`) — it
 * is a fact about how the *list* gets built, not about the student.
 *
 * So: just the identifier with its "why do we ask" popover, then the privacy
 * statement.
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
  return (
    <StepPage slug="student" lead={null}>
      <Card>
        <CardContent>
          <StudentIdField />
        </CardContent>
      </Card>

      <PrivacyNote />
    </StepPage>
  );
}
