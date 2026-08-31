"use client";

import { CalculatorIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { formatProgramLocation } from "@/components/list/program-location";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { RecommendationItem } from "@/lib/api/types";
import { formatBareInt } from "@/lib/format";
import {
  formatDistanceKm,
  formatPercent,
  formatRatio,
  isFiniteNumber,
} from "@/lib/recommendations";

import { riskLevelTone, ToneAlert } from "./tone-alert";

/**
 * One suggested program — the `st.container(border=True)` block of
 * `ui_recommendations.py`, field for field and in the same order.
 *
 * Every number arrives raw from `/recommend` and is only formatted here (§0:
 * the frontend never recomputes a probability). The impact alert's colour comes
 * from the engine's `risk_level`, not from a threshold comparison done in the
 * browser, so the green/orange/red boundaries cannot drift from the prototype's.
 *
 * The optional lines are dropped rather than dashed when their value is
 * missing, matching the prototype's `if distance != "" and not pd.isna(...)` /
 * `if np.isfinite(current) and projected_risk` guards. The location line is the
 * one deliberate exception (MIGRATION.md §9b.4): it always renders, because a
 * school name without its commune and region cannot be looked up or told apart
 * from its namesakes.
 *
 * Capacity and the estimated MTB rank use {@link formatBareInt}, not the
 * grouped `formatInt`: `ui_common.format_display_table` renders both with
 * `f"{int(round(float(x)))}"`, and a grouped "1.234" would read as 1.234 in
 * Spanish, where "." is the decimal separator's counterpart. The applicants-per-
 * seat ratio keeps its locale decimal comma, because that one *is* a decimal.
 */
export function RecommendationCard({
  item,
  currentUnmatchedRisk,
  selected,
  onSelectedChange,
}: {
  item: RecommendationItem;
  /** `current_unmatched_risk` of the same response — the "before" half of the
   *  impact sentence. */
  currentUnmatchedRisk: number | null;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();

  // Commune *and* region, always (MIGRATION.md §9b.4). A suggestion is a school
  // you have never heard of by definition, and dozens of Chilean schools share
  // a name across communes — the card title alone cannot identify one. Built by
  // the same helper the step-2 rows use, so both steps disambiguate alike.
  const location =
    formatProgramLocation(item.school_commune, item.region) ||
    t("improve.card.noInformation");

  const distance = formatDistanceKm(item.distance_km, locale);
  const showImpact =
    isFiniteNumber(currentUnmatchedRisk) &&
    isFiniteNumber(item.projected_unmatched_risk);
  const noInformation = t("improve.card.noInformation");

  // A candidate the API could not map back to a `program_id` cannot be appended
  // to the list, which stores ids only (§10). It is still shown — it is a real
  // suggestion the family may add by hand — but its checkbox is inert.
  const selectable =
    typeof item.program_id === "string" && item.program_id !== "";
  const checkboxId = `recommendation-${item.program_id ?? item.program_label}`;

  return (
    <Card
      data-testid="recommendation-card"
      data-program-id={item.program_id ?? ""}
      data-risk-level={item.risk_level}
    >
      <CardHeader>
        <CardTitle className="text-base">{item.school_name}</CardTitle>
        <CardDescription data-testid="recommendation-location">
          {location}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {item.program_display_name.trim() !== "" ? (
          <p className="text-sm">{item.program_display_name}</p>
        ) : null}

        {distance !== null ? (
          <p className="text-xs text-muted-foreground">
            {t("improve.distance.approx", { distance })}
          </p>
        ) : null}

        {showImpact ? (
          <ToneAlert
            tone={riskLevelTone(item.risk_level)}
            data-testid="recommendation-impact"
          >
            {t("improve.card.appendPreview", {
              current: formatPercent(currentUnmatchedRisk, locale),
              projected: formatPercent(item.projected_unmatched_risk, locale),
            })}
          </ToneAlert>
        ) : null}

        {isFiniteNumber(item.chance_if_considered) ? (
          <p className="text-sm">
            {t.rich("improve.card.chanceIfReached", {
              chance: formatPercent(item.chance_if_considered, locale),
              b: (chunks) => (
                <strong className="font-semibold">{chunks}</strong>
              ),
            })}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">{t("improve.card.why")}</p>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="self-start">
              <CalculatorIcon aria-hidden="true" data-icon="inline-start" />
              {t("improve.card.calcTrigger")}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-80"
            aria-label={t("improve.card.calcTrigger")}
          >
            <dl className="flex flex-col gap-1.5">
              <Detail
                label={t("improve.card.capacity")}
                value={
                  isFiniteNumber(item.capacity)
                    ? formatBareInt(item.capacity)
                    : noInformation
                }
              />
              <Detail
                label={t("improve.card.applicantsPerSeat")}
                value={
                  formatRatio(item.applicants_per_seat, locale) ?? noInformation
                }
              />
              <Detail
                label={t("improve.card.estimatedMtbRank")}
                value={
                  isFiniteNumber(item.estimated_mtb_rank)
                    ? formatBareInt(item.estimated_mtb_rank)
                    : noInformation
                }
              />
            </dl>
            <p className="text-xs text-muted-foreground">
              {t("improve.card.assumption")}
            </p>
          </PopoverContent>
        </Popover>

        <div className="flex items-start gap-2 border-t border-border pt-3">
          <Checkbox
            id={checkboxId}
            checked={selected}
            disabled={!selectable}
            onCheckedChange={(value) => onSelectedChange(value === true)}
            data-testid="recommendation-select"
          />
          <Label
            htmlFor={checkboxId}
            className="text-sm leading-snug font-normal"
          >
            {t("improve.card.add")}
          </Label>
        </div>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
