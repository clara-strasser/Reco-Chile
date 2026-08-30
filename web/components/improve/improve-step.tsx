"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { StepPage } from "@/components/wizard/step-page";
import { stepPath } from "@/components/wizard/steps";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useRouter } from "@/i18n/navigation";
import type { RecommendationItem } from "@/lib/api/types";
import {
  formatPercent,
  isFiniteNumber,
  MISSING_NUMBER,
  useRecommendations,
} from "@/lib/recommendations";
import {
  MAX_RECOMMENDATION_COUNT,
  MIN_RECOMMENDATION_COUNT,
  useWizardStore,
} from "@/lib/store/wizard";

import { AddressSection } from "./address-section";
import { apiErrorMessage } from "./api-error";
import { RecommendationCard } from "./recommendation-card";
import { ToneAlert } from "./tone-alert";

/**
 * Step 4 — improve the preference list (MIGRATION.md §4.1 row 4, Phase 5).
 *
 * A port of `sae_app/ui_recommendations.py`, section by section and in the same
 * order: current risk, the "adding at the end costs nothing" note, the method
 * collapsible, the optional home address, the display settings, then one card
 * per suggestion and the button that feeds the selection back into step 2.
 *
 * Nothing on this page computes a number. `/recommend` re-runs the simulation
 * server-side to obtain `current_unmatched_risk` and returns every figure raw
 * (§3), so the "before → after" sentence and the badge colours are the engine's
 * answers, formatted.
 */
export function ImproveStep() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const wishes = useWizardStore((state) => state.wishes);
  const recommendationCount = useWizardStore(
    (state) => state.recommendationCount,
  );
  const setRecommendationCount = useWizardStore(
    (state) => state.setRecommendationCount,
  );
  const appendRecommendations = useWizardStore(
    (state) => state.appendRecommendations,
  );
  const clearRecommendationsNotice = useWizardStore(
    (state) => state.clearRecommendationsNotice,
  );

  const { data, loading, error } = useRecommendations();

  // Program ids, not positions: the item list is replaced on every refetch, and
  // a family that nudged the slider must not lose what they already ticked.
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const items: RecommendationItem[] = data?.items ?? [];
  // Only what is on screen can be submitted; a tick left over from a wider
  // slider setting is remembered but does not count while it is hidden.
  const selectedVisible = items
    .map((item) => item.program_id)
    .filter((id): id is string => typeof id === "string" && id !== "")
    .filter((id) => selectedIds.has(id));

  /**
   * Appending is *staged* here and committed as this page unmounts.
   *
   * The reason is the step guard. `appendRecommendations` invalidates the
   * simulation (§4.2), which immediately makes step 4 unreachable; if that
   * lands while this page is still mounted, `(wizard)/layout.tsx`'s guard
   * redirects to the furthest step that IS still reachable — step 3, whose
   * gate only needs a non-empty list — and its `router.replace` overrides the
   * `router.push` to step 2 that §4.2 asks for. Verified: appending before the
   * push, or after it in the same handler, both land on `/result`.
   *
   * Committing the change in the unmount cleanup means the guard only ever
   * re-evaluates it against the route the family is actually going to. The
   * cost is that step 2's `recommendationsAddedNotice` banner reads the store
   * in a mount-time initializer and is therefore already past by then, so the
   * count is announced with the toast §4.2 specifies ("navigate to step 2 with
   * toast") and the store flag is cleared so it cannot resurface on a later
   * visit to step 2. If the guard is later taught not to hijack a navigation
   * the wizard itself started, this whole indirection — and the toast — should
   * go, and the banner takes over again.
   */
  const pendingAppend = React.useRef<readonly string[] | null>(null);
  React.useEffect(
    () => () => {
      const ids = pendingAppend.current;
      pendingAppend.current = null;
      if (ids === null || ids.length === 0) return;
      appendRecommendations(ids);
      clearRecommendationsNotice();
    },
    [appendRecommendations, clearRecommendationsNotice],
  );

  function toggle(programId: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(programId);
      else next.delete(programId);
      return next;
    });
  }

  function handleAdd() {
    const existing = new Set(wishes.map((wish) => wish.programId));
    // `selectedVisible` is already in recommendation order, which is the ranking
    // the engine produced — a checkbox records *which* programs were chosen, not
    // an order the family stated (`ui_recommendations.py` preserves it the same
    // way).
    const newIds = selectedVisible.filter((id) => !existing.has(id));

    if (newIds.length === 0) {
      toast.info(t("improve.empty.allAlreadyAdded"));
      return;
    }

    // §4.2: "navigate to step 2 with toast". The append itself is deferred to
    // the unmount cleanup above; it invalidates the simulation, which re-locks
    // step 4 until the family analyses the longer list again.
    pendingAppend.current = newIds;
    setSelectedIds(new Set());
    toast.success(t("list.notices.recommendationsAdded", { n: newIds.length }));
    router.push(stepPath("list"));
  }

  const currentRisk =
    data !== null && isFiniteNumber(data.current_unmatched_risk)
      ? formatPercent(data.current_unmatched_risk, locale)
      : null;
  const hasResponse = data !== null;
  const showSkeleton = loading && !hasResponse;

  return (
    <StepPage slug="improve">
      <Card>
        <CardContent className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            {t("improve.currentRisk")}
          </span>
          <span
            className="text-2xl font-semibold tabular-nums"
            data-testid="current-unmatched-risk"
          >
            {currentRisk ?? MISSING_NUMBER}
          </span>
        </CardContent>
      </Card>

      <ToneAlert tone="info">{t("improve.strategicNote")}</ToneAlert>

      <Disclosure label={t("improve.methodTitle")} testId="improve-method">
        <p className="text-sm">{t("improve.methodBody")}</p>
        <p className="text-sm">{t("improve.methodNote")}</p>
        <p className="text-xs text-muted-foreground">
          {t("improve.distance.coordsNote")}
        </p>
      </Disclosure>

      <Separator />

      <AddressSection
        hardDistanceFilterApplied={data?.hard_distance_filter_applied ?? null}
      />

      <Disclosure
        label={t("improve.displaySettings")}
        testId="improve-display-settings"
      >
        <div
          role="group"
          aria-label={t("improve.count.label")}
          className="flex flex-col gap-2"
        >
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span>{t("improve.count.label")}</span>
            <span
              className="font-medium tabular-nums"
              data-testid="recommendation-count"
            >
              {recommendationCount}
            </span>
          </div>
          <Slider
            value={[recommendationCount]}
            min={MIN_RECOMMENDATION_COUNT}
            max={MAX_RECOMMENDATION_COUNT}
            step={1}
            onValueChange={([value]) => setRecommendationCount(value)}
            data-testid="recommendation-count-slider"
          />
        </div>
      </Disclosure>

      {error !== null ? (
        <ToneAlert tone="destructive" data-testid="recommendation-error">
          {apiErrorMessage(t, error)}
        </ToneAlert>
      ) : null}

      {wishes.length === 0 ? (
        <ToneAlert tone="info">{t("improve.empty.needWishes")}</ToneAlert>
      ) : null}

      {data?.similarity_fallback_mode ? (
        <ToneAlert tone="info" data-testid="similarity-fallback">
          {t("improve.warning.similarityFallback")}
        </ToneAlert>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">{t("improve.subtitle")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("improve.selectHint")}
        </p>

        {showSkeleton ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : null}

        {hasResponse && items.length === 0 ? (
          <ToneAlert tone="warning" data-testid="recommendation-empty">
            {emptyMessage(t, data)}
          </ToneAlert>
        ) : null}

        {items.map((item) => (
          <RecommendationCard
            key={item.program_id ?? item.program_label}
            item={item}
            currentUnmatchedRisk={data?.current_unmatched_risk ?? null}
            selected={
              item.program_id !== null && selectedIds.has(item.program_id)
            }
            onSelectedChange={(selected) => {
              if (item.program_id) toggle(item.program_id, selected);
            }}
          />
        ))}
      </section>

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={selectedVisible.length === 0}
        onClick={handleAdd}
        data-testid="add-recommendations"
      >
        {t("improve.submit")}
      </Button>
    </StepPage>
  );
}

/**
 * The three "nothing to suggest" cases of `ui_recommendations.py`, in its order:
 * candidates that could not be evaluated at all beat the distance explanation,
 * which in turn beats the generic scoring message.
 */
function emptyMessage(
  t: (key: string) => string,
  data: {
    diagnostics: { failed_candidates: number };
    hard_distance_filter_applied: boolean;
  },
): string {
  if (data.diagnostics.failed_candidates > 0) {
    return t("improve.warning.failedCandidates");
  }
  if (data.hard_distance_filter_applied) {
    return t("improve.empty.noneMatched");
  }
  return t("improve.empty.noSimilar");
}

/** `st.expander` — a labelled disclosure with a chevron. */
function Disclosure({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <Collapsible
      className="rounded-lg border border-border"
      data-testid={testId}
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        {label}
        <ChevronDownIcon
          className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2 px-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
