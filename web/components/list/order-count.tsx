"use client";

/**
 * The equivalence-class order count under the list (ties mode only).
 *
 * Two states, both taken from the prototype:
 *
 * - within the limit — the caption `app.py` prints before the Analyze button,
 *   "The current equivalence classes generate {n} compatible strict order(s)…";
 * - above `/meta.max_exact_equiv_permutations` — the *same* message the API
 *   returns as 422 `too_many_equivalence_orders`, shown here so the family can
 *   split a group before pressing Continue instead of after
 *   (MIGRATION.md §3: "pre-checked client-side from `/meta`").
 *
 * The count itself is combinatorics over the family's own grouping — a product
 * of factorials, not a probability — so computing it in the browser does not
 * breach §0. It is re-checked server-side either way.
 */

import { useFormatter, useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { TriangleAlertIcon } from "lucide-react";
import { equivalenceOrderCount, useWizardStore } from "@/lib/store/wizard";
import { useMeta } from "@/lib/meta";

export function OrderCount() {
  const t = useTranslations();
  const format = useFormatter();
  const meta = useMeta();
  const wishes = useWizardStore((state) => state.wishes);
  const ties = useWizardStore((state) => state.useEquivalenceClasses);

  if (!ties || wishes.length === 0) return null;

  // A single 19-wish class already overflows `Number.MAX_SAFE_INTEGER`, so the
  // count stays a bigint and is formatted, never converted.
  const orders = equivalenceOrderCount(wishes);
  const limit = BigInt(meta.max_exact_equiv_permutations);
  const n = format.number(orders);

  if (orders > limit) {
    return (
      <Alert variant="destructive" data-testid="order-count-over-cap">
        <TriangleAlertIcon aria-hidden="true" />
        <AlertDescription>
          {t("errors.too_many_equivalence_orders", {
            n,
            limit: format.number(meta.max_exact_equiv_permutations),
          })}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <p className="text-sm text-muted-foreground" data-testid="order-count">
      {t("list.notices.orderCount", { n })}
    </p>
  );
}
