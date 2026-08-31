"use client";

/**
 * Step 3 — review the result (MIGRATION.md §4.1, Phase 4; reshaped by §9b).
 *
 * The step runs `/simulate` on entry whenever the stored result is stale, then
 * renders, top to bottom:
 *
 *   headline (chance of being assigned, most likely school, estimate caption)
 *   -> outcomes (top four + all of them) and the interpretation popover
 *   -> ties mode:   sensitivity verdict, per-order view, reference + technical
 *      strict mode: family table, chance popover, detailed calculation
 *   -> the finish / improve choice
 *
 * Product feedback round 1 (§9b, items 5–6) put the two figures first and took
 * the attention-level alerts and their thresholds out entirely; everything the
 * prototype showed below them is still here, moved down or into a disclosure.
 *
 * Which branch is shown follows the *mode the family chose*, exactly as
 * `app.py` does: it stores `mode: "equivalence"` whenever the ties toggle is
 * on, so `render_simulation_result` draws the equivalence block even for a
 * list whose groups happen to be all singletons ("All 1 compatible strict
 * order(s) lead to: X"). The API cannot say that on its own — it omits
 * `equivalence_sensitivity` when there is only one compatible order — so the
 * branch reads the store flag and `equivalenceView` fills the one-order case
 * in (see `lib/simulation/equivalence.ts`).
 */

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { StepPage } from "@/components/wizard/step-page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { equivalenceView, useSimulation } from "@/lib/simulation";
import type { SimulationError } from "@/lib/simulation/use-simulation";
import { useWizardStore } from "@/lib/store/wizard";

import { EquivalenceBlock } from "./equivalence-block";
import { FamilyChanceTable } from "./family-chance-table";
import { ResultActions } from "./result-actions";
import { ResultHeadline } from "./result-headline";
import { ResultSummary } from "./result-summary";

export function ResultStep() {
  const { simulation, loading, error, retry } = useSimulation();

  const hasStudentId = useWizardStore((state) => state.studentId.trim() !== "");
  const hasWishes = useWizardStore((state) => state.wishes.length > 0);
  const useEquivalenceClasses = useWizardStore(
    (state) => state.useEquivalenceClasses,
  );

  return (
    <StepPage slug="result">
      {error ? (
        <SimulationErrorAlert error={error} onRetry={retry} />
      ) : loading ? (
        <ResultSkeleton />
      ) : simulation ? (
        <div className="flex flex-col gap-8">
          <ResultHeadline simulation={simulation} />
          <ResultSummary simulation={simulation} />
          {useEquivalenceClasses ? (
            <EquivalenceBlock
              simulation={simulation}
              sensitivity={equivalenceView(simulation)}
            />
          ) : (
            <FamilyChanceTable simulation={simulation} />
          )}
          <ResultActions />
        </div>
      ) : (
        // The step guard normally keeps this state unreachable; it is what the
        // family sees if they land here with an incomplete list anyway.
        <MissingInputNotice hasStudentId={hasStudentId} hasWishes={hasWishes} />
      )}
    </StepPage>
  );
}

/** The shape of the result, while `/simulate` is running. */
function ResultSkeleton() {
  const t = useTranslations("result");

  return (
    <div className="flex flex-col gap-6" data-testid="result-loading">
      <span className="sr-only" role="status">
        {t("running")}
      </span>
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * A failed `/simulate`. The message is already localized — either from the
 * local catalogue for a known `error_key` (the over-cap 422 among them) or
 * from the API's own `message` — and never contains the request body (§4.5).
 */
function SimulationErrorAlert({
  error,
  onRetry,
}: {
  error: SimulationError;
  onRetry: () => void;
}) {
  const t = useTranslations();

  return (
    <Alert
      variant="destructive"
      data-testid="result-error"
      data-error-key={error.key}
    >
      <TriangleAlertIcon aria-hidden="true" />
      <AlertTitle>{t("result.errors.title")}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <span>{error.message}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          data-testid="result-retry"
        >
          <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
          {t("app.error.retry")}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** `app.py`'s two "unlock the analysis" captions. */
function MissingInputNotice({
  hasStudentId,
  hasWishes,
}: {
  hasStudentId: boolean;
  hasWishes: boolean;
}) {
  const t = useTranslations();

  return (
    <Alert data-testid="result-missing-input">
      <TriangleAlertIcon aria-hidden="true" />
      <AlertDescription>
        {!hasStudentId
          ? t("errors.studentIdRequired")
          : !hasWishes
            ? t("errors.addValidProgram")
            : t("errors.unexpected")}
      </AlertDescription>
    </Alert>
  );
}
