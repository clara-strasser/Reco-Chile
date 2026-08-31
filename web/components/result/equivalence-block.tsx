"use client";

/**
 * Ties mode — "Does the undecided internal order matter?".
 *
 * A port of the equivalence branch of `ui_simulation.render_simulation_result`
 * plus `_family_order_view`, in the same order and with the same three
 * verdicts. The verdict itself is decided server-side (`_equivalence_verdict`,
 * the same comparison against `EQUIV_PROBABILITY_CHANGE_WARNING_THRESHOLD` the
 * prototype makes) and arrives as `equivalence_sensitivity.verdict`; this
 * component only chooses copy and severity for it.
 *
 * The per-order view appears exactly when the prototype shows it: whenever the
 * verdict is not `stable`. Twelve or fewer compatible orders get one card each;
 * above that they are grouped by their most likely outcome, since a family
 * cannot read hundreds of cards.
 *
 * The block is rendered for every ties-mode run, including one whose groups are
 * all singletons: `sensitivity` is then the one-order block synthesized by
 * `lib/simulation/equivalence.ts`, and the verdict reads "All 1 compatible
 * strict order(s) lead to: X", exactly as the prototype prints it.
 *
 * Both tables that list permutations are paginated (see `./paged-rows`): the
 * largest list a family can reach is seven tied programs, 5,040 orders.
 */

import type { ReactNode } from "react";
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EquivalenceSensitivity,
  SimulationResponse,
  SimulationVariant,
} from "@/lib/api/types";
import { formatInt, formatPercent } from "@/lib/format";

import { DetailTable } from "./detail-table";
import { useResultLabels, type ResultLabels } from "./labels";
import { PagedRowsFooter, usePagedRows } from "./paged-rows";
import { strictOrderLine, tiedGroupLabels, tiedOrderLine } from "./tied-order";

/** Above this many compatible orders the cards become grouped tables. */
const MAX_ORDER_CARDS = 12;

const VERDICT_COPY = {
  stable: {
    message: "equivalence.verdict.stable",
    advice: "equivalence.advice.stable",
  },
  stable_probability_shift: {
    message: "equivalence.verdict.stableProbabilityShift",
    advice: "equivalence.advice.stableProbabilityShift",
  },
  outcome_changes: {
    message: "equivalence.verdict.outcomeChanges",
    advice: "equivalence.advice.outcomeChanges",
  },
} as const;

type Verdict = keyof typeof VERDICT_COPY;

function isVerdict(value: string): value is Verdict {
  return value in VERDICT_COPY;
}

export function EquivalenceBlock({
  simulation,
  sensitivity,
}: {
  simulation: SimulationResponse;
  sensitivity: EquivalenceSensitivity;
}) {
  const t = useTranslations("result");
  const locale = useLocale();
  const labels = useResultLabels(simulation);

  const verdict: Verdict = isVerdict(sensitivity.verdict)
    ? sensitivity.verdict
    : "outcome_changes";
  const stable = verdict === "stable";
  // With a stable outcome every variant predicts the same school, so the first
  // one names it — the engine's `distinct_outcomes[0]`.
  const outcome = labels.outcome(
    sensitivity.variants[0]?.predicted_outcome ?? simulation.predicted_outcome,
  );

  const bold = (chunks: ReactNode) => (
    <strong className="font-semibold">{chunks}</strong>
  );

  return (
    <section className="flex flex-col gap-4" data-testid="equivalence-block">
      <h2 className="text-lg font-semibold tracking-tight">
        {t("equivalence.question")}
      </h2>

      <Alert
        data-testid="equivalence-verdict"
        data-verdict={verdict}
        className={
          stable
            ? "border-emerald-600/40 text-emerald-700 dark:text-emerald-400 [&_[data-slot=alert-description]]:text-emerald-700 dark:[&_[data-slot=alert-description]]:text-emerald-400"
            : "border-amber-500/40 text-amber-700 dark:text-amber-400 [&_[data-slot=alert-description]]:text-amber-700 dark:[&_[data-slot=alert-description]]:text-amber-400"
        }
      >
        {stable ? (
          <CircleCheckIcon aria-hidden="true" />
        ) : (
          <TriangleAlertIcon aria-hidden="true" />
        )}
        <AlertDescription>
          {t.rich(VERDICT_COPY[verdict].message, {
            b: bold,
            outcome,
            n: formatInt(sensitivity.total_orders, locale),
            minChance: formatPercent(sensitivity.predicted_chance_min, locale),
            maxChance: formatPercent(sensitivity.predicted_chance_max, locale),
          })}
        </AlertDescription>
      </Alert>

      <p className="text-sm text-muted-foreground">
        {t(VERDICT_COPY[verdict].advice)}
      </p>

      {stable ? null : (
        <TiedOrderView variants={sensitivity.variants} labels={labels} />
      )}

      <Disclosure label={t("equivalence.referenceTitle")}>
        <p className="text-muted-foreground">
          {t("equivalence.referenceNote")}
        </p>
        <DetailTable simulation={simulation} testId="reference-detail-table" />
      </Disclosure>

      <Disclosure label={t("equivalence.technicalTitle")}>
        <p className="text-muted-foreground">
          {t("equivalence.technicalNote")}
        </p>
        <TechnicalVariantsTable
          variants={sensitivity.variants}
          labels={labels}
        />
      </Disclosure>
    </section>
  );
}

/** `_family_order_view`: what each order inside the tied programs leads to. */
function TiedOrderView({
  variants,
  labels,
}: {
  variants: SimulationVariant[];
  labels: ResultLabels;
}) {
  const t = useTranslations("result");
  const locale = useLocale();

  return (
    <section className="flex flex-col gap-3" data-testid="tied-order-view">
      <h3 className="text-sm font-semibold">{t("equivalence.ordersTitle")}</h3>
      <p className="text-sm text-muted-foreground">
        {t("equivalence.onlyTiedShown")}
      </p>

      {variants.length <= MAX_ORDER_CARDS ? (
        <div className="flex flex-col gap-3">
          {variants.map((variant, index) => (
            <OrderCard
              key={variant.order_index}
              variant={variant}
              number={index + 1}
              labels={labels}
            />
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t("equivalence.groupedNotice", {
              n: formatInt(variants.length, locale),
            })}
          </p>
          <GroupedOrders variants={variants} labels={labels} />
        </>
      )}

      <Alert data-testid="tied-order-advice">
        <InfoIcon aria-hidden="true" />
        <AlertDescription>{t("equivalence.chooseFirst")}</AlertDescription>
      </Alert>
    </section>
  );
}

/** One `st.container(border=True)` of the prototype: "Option n". */
function OrderCard({
  variant,
  number,
  labels,
}: {
  variant: SimulationVariant;
  number: number;
  labels: ResultLabels;
}) {
  const t = useTranslations("result");
  const locale = useLocale();
  const groups = tiedGroupLabels(variant, labels);

  return (
    <Card data-testid="order-card">
      <CardContent className="flex flex-col gap-3">
        <h4 className="font-semibold">
          {t("equivalence.optionTitle", { number })}
        </h4>
        <p className="text-sm font-medium">{t("equivalence.placeInOrder")}</p>

        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("equivalence.noTiedOrder")}
          </p>
        ) : (
          groups.map((programs, groupIndex) => (
            <div key={groupIndex} className="flex flex-col gap-1 text-sm">
              {groups.length > 1 ? (
                <p className="font-medium">
                  {t("equivalence.tiedGroup", { group: groupIndex + 1 })}
                </p>
              ) : null}
              <ol className="flex list-inside list-decimal flex-col gap-0.5">
                {programs.map((program, position) => (
                  <li key={`${program}-${position}`}>{program}</li>
                ))}
              </ol>
            </div>
          ))
        )}

        <p className="text-sm">
          {t.rich("outcomes.mostLikely", {
            b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
            outcome: labels.outcome(variant.predicted_outcome),
          })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("outcomes.finalChanceFor", {
            chance: formatPercent(
              variant.predicted_outcome_final_chance,
              locale,
            ),
          })}
        </p>
      </CardContent>
    </Card>
  );
}

/** Above twelve orders: one collapsible per distinct predicted outcome. */
function GroupedOrders({
  variants,
  labels,
}: {
  variants: SimulationVariant[];
  labels: ResultLabels;
}) {
  const t = useTranslations("result");
  const locale = useLocale();

  // First-seen order, like `groupby(..., sort=False)` in the prototype.
  const groups = new Map<string, SimulationVariant[]>();
  for (const variant of variants) {
    const bucket = groups.get(variant.predicted_outcome);
    if (bucket) bucket.push(variant);
    else groups.set(variant.predicted_outcome, [variant]);
  }

  return (
    <div className="flex flex-col gap-2" data-testid="grouped-orders">
      {[...groups.entries()].map(([outcome, rows]) => (
        <Disclosure
          key={outcome}
          data-testid="grouped-outcome"
          label={t("equivalence.groupedRow", {
            outcome: labels.outcome(outcome),
            n: formatInt(rows.length, locale),
          })}
        >
          <GroupedOutcomeTable variants={rows} labels={labels} />
        </Disclosure>
      ))}
    </div>
  );
}

/** The orders that share one predicted outcome, paginated like the technical
 *  table — a single group can hold every one of the 5,040 reachable orders. */
function GroupedOutcomeTable({
  variants,
  labels,
}: {
  variants: SimulationVariant[];
  labels: ResultLabels;
}) {
  const t = useTranslations("result");
  const locale = useLocale();
  const rows = usePagedRows(variants);

  return (
    <>
      <div className="w-full overflow-x-auto">
        <Table data-testid="grouped-outcome-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t("equivalence.orderInside")}</TableHead>
              <TableHead className="text-right">
                {t("table.predictedOutcomeChance")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.visible.map((variant) => (
              <TableRow key={variant.order_index}>
                <TableCell>{tiedOrderLine(variant, labels)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(
                    variant.predicted_outcome_final_chance,
                    locale,
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PagedRowsFooter rows={rows} />
    </>
  );
}

/** "Technical details of all tested orders" — every permutation in full. */
function TechnicalVariantsTable({
  variants,
  labels,
}: {
  variants: SimulationVariant[];
  labels: ResultLabels;
}) {
  const t = useTranslations("result");
  const tApp = useTranslations("app");
  const locale = useLocale();
  const rows = usePagedRows(variants);

  return (
    <>
      <div className="w-full overflow-x-auto">
        <Table data-testid="technical-variants-table">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">
                {t("table.strictOrder")}
              </TableHead>
              <TableHead>{t("table.predictedOutcome")}</TableHead>
              <TableHead className="text-right">
                {t("table.predictedOutcomeChance")}
              </TableHead>
              <TableHead>{t("table.flaggedAtRisk")}</TableHead>
              <TableHead>{t("table.strictOrderFull")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.visible.map((variant) => (
              <TableRow key={variant.order_index}>
                <TableCell className="text-right tabular-nums">
                  {formatInt(variant.order_index, locale)}
                </TableCell>
                <TableCell>
                  {labels.outcome(variant.predicted_outcome)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPercent(
                    variant.predicted_outcome_final_chance,
                    locale,
                  )}
                </TableCell>
                <TableCell>
                  {variant.at_risk ? tApp("yes") : tApp("no")}
                </TableCell>
                <TableCell>{strictOrderLine(variant, labels)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PagedRowsFooter rows={rows} />
    </>
  );
}
