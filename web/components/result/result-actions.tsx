"use client";

/**
 * "Finish" vs "improve my list" — MIGRATION.md §9b, item 6.
 *
 * The prototype (and the wizard until now) let step 3 flow into step 4 through
 * one anonymous Continue, which reads as "you are not done yet" even for a list
 * the family is happy with. Product feedback round 1 asks for the choice to be
 * explicit: a primary *I'm happy — finish* that leaves the wizard, and a
 * secondary *not happy — help me improve my list* that goes to step 4.
 *
 * Both are links, not buttons: they are plain navigations, so they open in a new
 * tab, are focusable, and work before hydration. The bottom `WizardNav` still
 * renders its own Continue for step 3 (it belongs to the shell, not to this
 * step) — see `notes_for_next_phase` in the F1 log.
 */

import { ArrowRightIcon, CheckIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { FINISH_PATH, stepPath } from "@/components/wizard/steps";
import { Link } from "@/i18n/navigation";

// Both destinations are locale-free paths — `Link` from `@/i18n/navigation`
// adds the `[locale]` segment. `FINISH_PATH` is its own constant rather than a
// `stepPath(...)` because `finish` is not one of the four `STEP_SLUGS`: it is
// where the wizard ends, not a fifth step with a gate.

export function ResultActions() {
  const t = useTranslations("result.next");

  return (
    <section className="flex flex-col gap-3" data-testid="result-actions">
      <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col items-start gap-2 rounded-lg border border-border p-4">
          <Button
            size="lg"
            asChild
            // Long copy wraps instead of running past the card on a 360 px
            // phone: `Button` is `whitespace-nowrap` with a fixed height.
            className="h-auto min-h-11 py-2.5 text-left whitespace-normal"
            data-testid="result-finish"
          >
            <Link href={FINISH_PATH}>
              <CheckIcon aria-hidden="true" data-icon="inline-start" />
              {t("finish")}
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">{t("finishHint")}</p>
        </div>

        <div className="flex flex-col items-start gap-2 rounded-lg border border-border p-4">
          <Button
            size="lg"
            variant="outline"
            asChild
            className="h-auto min-h-11 py-2.5 text-left whitespace-normal"
            data-testid="result-improve"
          >
            <Link href={stepPath("improve")}>
              <SparklesIcon aria-hidden="true" data-icon="inline-start" />
              {t("improve")}
              <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">{t("improveHint")}</p>
        </div>
      </div>
    </section>
  );
}
