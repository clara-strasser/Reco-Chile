"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { WELCOME_PATH } from "@/components/wizard/steps";
import { useWizardStore } from "@/lib/store/wizard";

/**
 * What the family answered on the welcome page, plus a way back to change it
 * (MIGRATION.md §9b item 2).
 *
 * The prototype asked "is the wish list already established?" with a radio on
 * step 1; the welcome page now asks it as the wizard's opening question, so all
 * that is left here is the answer itself — it still decides whether step 2
 * offers the filter panel, and a family that clicked the wrong button needs to
 * see that and undo it without hunting for the control.
 *
 * The answer text is `app.welcome.yes` / `app.welcome.no`, i.e. the labels of
 * the very buttons that were pressed — one sentence, one id, no drift.
 *
 * `null` renders nothing: inside a guarded step it cannot happen
 * (`canEnterStep(1)` requires the choice), and if it ever did, an empty note is
 * better than one claiming an answer nobody gave.
 */
export function ListChoiceNote() {
  const t = useTranslations();
  const listExists = useWizardStore((state) => state.listExists);

  if (listExists === null) return null;

  return (
    <p
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
      data-testid="list-choice-note"
    >
      <span>
        {t("student.listChoice.note", {
          answer: t(listExists ? "app.welcome.yes" : "app.welcome.no"),
        })}
      </span>
      <Link
        href={WELCOME_PATH}
        className="rounded-sm font-medium text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        data-testid="list-choice-change"
      >
        {t("student.listChoice.change")}
      </Link>
    </p>
  );
}
