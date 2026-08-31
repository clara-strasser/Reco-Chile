"use client";

/**
 * Row pagination for the two ties-mode tables that can list every tested
 * permutation.
 *
 * `MAX_EXACT_EQUIV_PERMUTATIONS` is 10,000 and the counts are products of
 * factorials, so the largest list a family can actually reach is seven tied
 * programs — 5,040 orders. Rendering that many `<tr>`s (five cells each, one of
 * them a full strict ranking of school names) costs tens of thousands of DOM
 * nodes and makes the step janky on a phone, which is exactly the risk
 * MIGRATION.md §10 records ("the UI groups by outcome above 12 and paginates
 * technical tables").
 *
 * So the table starts at {@link PAGE_SIZE} rows and grows by that much per
 * click, with a caption saying how much of the whole is on screen. Nothing is
 * hidden: every order stays reachable, and the numbers themselves are
 * untouched — this is a rendering budget, not a filter.
 */

import { useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatInt } from "@/lib/format";

/** Rows rendered initially, and appended per "Show more" click. */
export const PAGE_SIZE = 50;

export type PagedRows<T> = {
  /** The slice to render. */
  visible: readonly T[];
  /** How many rows are on screen, and how many exist in total. */
  shown: number;
  total: number;
  /** True once there is more than one page — the footer is shown only then. */
  paginated: boolean;
  /** True while rows remain — the "Show more" button is shown only then. */
  hasMore: boolean;
  showMore: () => void;
};

export function usePagedRows<T>(rows: readonly T[]): PagedRows<T> {
  const [shown, setShown] = useState(PAGE_SIZE);
  // A different list (a new simulation, another outcome group) starts at the
  // first page again. Adjusting state during render is React's own recipe for
  // "derive state from props"; an effect would paint a stale long list first.
  const [seenLength, setSeenLength] = useState(rows.length);
  if (seenLength !== rows.length) {
    setSeenLength(rows.length);
    setShown(PAGE_SIZE);
  }

  const capped = Math.min(shown, rows.length);
  return {
    visible: rows.length > PAGE_SIZE ? rows.slice(0, capped) : rows,
    shown: capped,
    total: rows.length,
    paginated: rows.length > PAGE_SIZE,
    hasMore: capped < rows.length,
    showMore: () => setShown((value) => value + PAGE_SIZE),
  };
}

/** "Showing 50 of 5,040" plus the button that appends the next page. */
export function PagedRowsFooter<T>({ rows }: { rows: PagedRows<T> }) {
  const t = useTranslations("result.pagination");
  const locale = useLocale();
  const captionId = useId();

  if (!rows.paginated) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p
        id={captionId}
        role="status"
        className="text-sm text-muted-foreground"
        data-testid="rows-shown"
      >
        {t("showing", {
          shown: formatInt(rows.shown, locale),
          total: formatInt(rows.total, locale),
        })}
      </p>
      {rows.hasMore ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={rows.showMore}
          aria-describedby={captionId}
          data-testid="show-more-rows"
        >
          {t("showMore")}
        </Button>
      ) : null}
    </div>
  );
}
