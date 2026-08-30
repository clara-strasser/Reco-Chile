"use client";

/**
 * The summary block of step 3 — a direct port of
 * `ui_simulation.render_single_summary`, in the same order:
 *
 *   metric -> attention alert -> "this is an estimate" caption ->
 *   most likely outcomes (top 4 + "show all") -> interpretation popover ->
 *   "how are the attention levels defined?"
 *
 * Every number is rendered from the response through `formatPercent`, the
 * mirror of the prototype's `{:.1%}`; nothing is recomputed here. The three
 * attention levels come from the API (`attention_level`, computed with the
 * same thresholds as `render_single_summary`), and the thresholds quoted in
 * the definition text come from `/meta` (MIGRATION.md §4.4: "no threshold is
 * hard-coded in `web/`").
 */

import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SimulationResponse } from "@/lib/api/types";
import { formatPercent } from "@/lib/format";
import { useMeta } from "@/lib/meta";
import { cn } from "@/lib/utils";

import { Disclosure } from "./disclosure";
import { useResultLabels } from "./labels";

/** How many outcomes the podium shows before the "show all" disclosure. */
const PODIUM_SIZE = 4;

/** Alert look per attention level: `st.error` / `st.warning` / `st.success`. */
const ATTENTION = {
  high: {
    icon: CircleAlertIcon,
    className: "border-destructive/40 text-destructive",
  },
  moderate: {
    icon: TriangleAlertIcon,
    className:
      "border-amber-500/40 text-amber-700 dark:text-amber-400 [&_[data-slot=alert-description]]:text-amber-700 dark:[&_[data-slot=alert-description]]:text-amber-400",
  },
  low: {
    icon: CircleCheckIcon,
    className:
      "border-emerald-600/40 text-emerald-700 dark:text-emerald-400 [&_[data-slot=alert-description]]:text-emerald-700 dark:[&_[data-slot=alert-description]]:text-emerald-400",
  },
} as const;

type AttentionLevel = keyof typeof ATTENTION;

function isAttentionLevel(value: string): value is AttentionLevel {
  return value in ATTENTION;
}

export function ResultSummary({
  simulation,
}: {
  simulation: SimulationResponse;
}) {
  const t = useTranslations("result");
  const locale = useLocale();
  const meta = useMeta();
  const labels = useResultLabels(simulation);

  const level: AttentionLevel = isAttentionLevel(simulation.attention_level)
    ? simulation.attention_level
    : "low";
  const { icon: AttentionIcon, className: attentionClassName } =
    ATTENTION[level];

  const outcomes = simulation.outcomes;
  const podium = outcomes.slice(0, PODIUM_SIZE);

  return (
    <section className="flex flex-col gap-4" data-testid="result-summary">
      <h3 className="text-lg font-semibold tracking-tight">{t("heading")}</h3>

      {/* `st.metric`: the label above, the number as the one big figure. */}
      <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
        <span className="text-sm text-muted-foreground">{t("riskLabel")}</span>
        <span
          className="text-3xl font-semibold tabular-nums"
          data-testid="unmatched-risk"
        >
          {formatPercent(simulation.unmatched_risk, locale)}
        </span>
      </div>

      <Alert
        className={cn(attentionClassName)}
        data-testid="attention-alert"
        data-level={level}
      >
        <AttentionIcon aria-hidden="true" />
        <AlertDescription>{t(`attention.${level}`)}</AlertDescription>
      </Alert>

      <p className="text-sm text-muted-foreground">
        {t("explain.percentagesBody")}
      </p>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold">{t("outcomes.title")}</h4>
        <ol
          className="flex flex-col gap-1 text-sm"
          data-testid="outcome-podium"
        >
          {podium.map((outcome, index) => (
            <li
              key={`${outcome.program_id ?? outcome.label}-${index}`}
              className="flex items-baseline justify-between gap-3"
              data-testid="outcome-item"
            >
              <span>
                <span className="text-muted-foreground">{index + 1}. </span>
                <strong className="font-medium">
                  {labels.outcome(outcome.label)}
                </strong>
              </span>
              <span className="tabular-nums">
                {formatPercent(outcome.probability, locale)}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {outcomes.length > PODIUM_SIZE ? (
        <Disclosure label={t("outcomes.showAll")}>
          <ol className="flex flex-col gap-1" data-testid="all-outcomes">
            {outcomes.map((outcome, index) => (
              <li
                key={`${outcome.program_id ?? outcome.label}-${index}`}
                className="flex items-baseline justify-between gap-3"
              >
                <span>
                  <span className="text-muted-foreground">{index + 1}. </span>
                  {labels.outcome(outcome.label)}
                </span>
                <span className="tabular-nums">
                  {formatPercent(outcome.probability, locale)}
                </span>
              </li>
            ))}
          </ol>
        </Disclosure>
      ) : null}

      <div>
        <Popover>
          <PopoverTrigger className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <InfoIcon aria-hidden="true" className="size-4" />
            {t("explain.percentagesTitle")}
          </PopoverTrigger>
          <PopoverContent align="start">
            <PopoverDescription>{t("attention.ordering")}</PopoverDescription>
            <PopoverDescription>
              {t("explain.finalChanceNote")}
            </PopoverDescription>
          </PopoverContent>
        </Popover>
      </div>

      <Disclosure label={t("attention.definitionTitle")}>
        <p className="text-muted-foreground">
          {t("attention.definitionBody", {
            soft: formatPercent(meta.soft_unmatched_threshold, locale),
            hard: formatPercent(meta.hard_unmatched_threshold, locale),
          })}
        </p>
      </Disclosure>
    </section>
  );
}
