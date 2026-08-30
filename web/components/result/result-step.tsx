"use client";

/**
 * Step 3 — review the result (MIGRATION.md §4.1, Phase 4).
 *
 * The step runs `/simulate` on entry whenever the stored result is stale, then
 * renders the prototype's section 3 in its original order:
 *
 *   summary (metric, attention alert, outcomes, explanations)
 *   -> ties mode:   sensitivity verdict, per-order view, reference + technical
 *      strict mode: family table, chance popover, detailed calculation
 *
 * Which branch is shown follows the response, not the store: the API attaches
 * `equivalence_sensitivity` only when the list really produces more than one
 * compatible strict order, which is the same condition `app.py` uses.
 */

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { StepPage } from "@/components/wizard/step-page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSimulation } from "@/lib/simulation";
import type { SimulationError } from "@/lib/simulation/use-simulation";
import { useWizardStore } from "@/lib/store/wizard";

import { EquivalenceBlock } from "./equivalence-block";
import { FamilyChanceTable } from "./family-chance-table";
import { ResultSummary } from "./result-summary";

export function ResultStep() {
  const { simulation, loading, error, retry } = useSimulation();

  const hasStudentId = useWizardStore((state) => state.studentId.trim() !== "");
  const hasWishes = useWizardStore((state) => state.wishes.length > 0);

  return (
    <StepPage slug="result">
      {error ? (
        <SimulationErrorAlert error={error} onRetry={retry} />
      ) : loading ? (
        <ResultSkeleton />
      ) : simulation ? (
        <div className="flex flex-col gap-8">
          <ResultSummary simulation={simulation} />
          {simulation.equivalence_sensitivity ? (
            <EquivalenceBlock
              simulation={simulation}
              sensitivity={simulation.equivalence_sensitivity}
            />
          ) : (
            <FamilyChanceTable simulation={simulation} />
          )}
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
