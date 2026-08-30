"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";

import { nextSlug, previousSlug, stepPath, type StepSlug } from "./steps";

/**
 * The `[← Back]                [Continue →]` bar of MIGRATION.md §4.1.
 *
 * Sticky to the bottom of the viewport so it stays reachable on a phone without
 * scrolling past a long wish list. `-mx-4 px-4` bleeds the rule and the backdrop
 * to the edges of the locale layout's padded column while the buttons stay
 * aligned with the step content.
 *
 * Continue is a button rather than a link because it has a disabled state: a
 * disabled link is not focusable and would simply drop out of the tab order
 * whenever the step's gate does not hold.
 */
export function WizardNav({
  slug,
  canContinue,
}: {
  slug: StepSlug;
  /** `canContinue` for the live store state (§4.1, "Continue enabled when"). */
  canContinue: boolean;
}) {
  const t = useTranslations("steps");
  const router = useRouter();

  const back = previousSlug(slug);
  const forward = nextSlug(slug);

  return (
    <div className="sticky bottom-0 -mx-4 mt-4 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
      {back ? (
        <Button variant="ghost" size="lg" asChild data-testid="wizard-back">
          <Link href={stepPath(back)}>
            <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" />
            {t("back")}
          </Link>
        </Button>
      ) : (
        // Keeps Continue flush right on the first step without a second row.
        <span />
      )}

      {forward ? (
        <Button
          size="lg"
          data-testid="wizard-continue"
          disabled={!canContinue}
          onClick={() => router.push(stepPath(forward))}
        >
          {t("continue")}
          <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
        </Button>
      ) : null}
    </div>
  );
}
