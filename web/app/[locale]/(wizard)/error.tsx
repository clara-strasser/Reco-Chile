"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

/**
 * Error boundary for the wizard route group (MIGRATION.md §9, Phase 2 leftover
 * "`error.tsx` under `(wizard)`").
 *
 * Scope: Next wraps a segment's *children*, not the segment's own layout, so
 * this covers the four step pages and everything they render — the `/simulate`,
 * `/programs`, `/recommend` and `/geocode` calls of Phases 3–5 — but not the
 * `fetchMeta()` that `(wizard)/layout.tsx` awaits. An unreachable FastAPI at
 * layout time still bubbles past this boundary; catching that needs an
 * `error.tsx` one segment up, which is a separate decision because it would
 * also have to render without the wizard chrome.
 *
 * PRIVACY (MIGRATION.md §4.5): the error is never rendered and never logged.
 * `error.message` may carry an upstream URL, a query string or a serialized
 * request, and requests to `/simulate`, `/recommend` and `/geocode` carry the
 * RUN/IPE and the family's home address. Only a fixed sentence is shown, plus
 * `error.digest` — an opaque hash Next generates so a server-side log line can
 * be found without the family ever reading the cause.
 *
 * The locale layout above stays mounted, so `NextIntlClientProvider`, the
 * header and the language switcher are still there and the copy is localized.
 */
export default function WizardError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  /** Re-renders the boundary's children from the client's existing data. */
  reset: () => void;
  /**
   * Next 16's preferred recovery: re-fetches the segment before re-rendering,
   * which is what a failed `/simulate` or `/programs` actually needs. It is typed
   * optional so the component still satisfies the older `reset`-only contract.
   */
  retry?: () => void;
}) {
  const t = useTranslations("app.error");
  const recover = retry ?? reset;

  return (
    <Alert variant="destructive" data-testid="wizard-error">
      <TriangleAlertIcon aria-hidden="true" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>
        <p>{t("body")}</p>
        {error.digest ? (
          <p
            className="mt-2 font-mono text-xs"
            data-testid="wizard-error-digest"
          >
            {t("digest", { digest: error.digest })}
          </p>
        ) : null}
      </AlertDescription>
      <AlertAction>
        <Button
          size="sm"
          variant="outline"
          onClick={() => recover()}
          data-testid="wizard-error-retry"
        >
          <RotateCcwIcon aria-hidden="true" data-icon="inline-start" />
          {t("retry")}
        </Button>
      </AlertAction>
    </Alert>
  );
}
