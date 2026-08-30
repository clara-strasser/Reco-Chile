import type { ReactNode } from "react";

import { WizardShell } from "@/components/wizard/wizard-shell";
import { fetchMeta } from "@/lib/meta/fetch-meta";

/**
 * Wizard layout — MIGRATION.md §2.1 / §4.1 ("stepper + step guard").
 *
 * A server component on purpose: it is the only place that can `await`
 * `fetchMeta()`, so `/meta` is read once per render on the server and handed to
 * the client tree as a plain object. `WizardShell` is the `"use client"`
 * boundary and owns everything interactive — stepper, step guard, Back/Continue.
 *
 * The route group `(wizard)` keeps this layout out of the URL: the steps are
 * `/es/student`, `/es/list`, `/es/result`, `/es/improve`.
 *
 * The `<html lang>`, the `NextIntlClientProvider` and the locale switcher live
 * one level up in `app/[locale]/layout.tsx`.
 */

/**
 * Render per request, not at build time.
 *
 * `/meta` carries the live thresholds, limits and data fingerprint of whichever
 * API instance is actually serving, so baking them into a prerendered shell
 * would let a redeployed engine and the UI that explains it drift apart. It also
 * means `pnpm build` does not need a reachable FastAPI.
 */
export const dynamic = "force-dynamic";

export default async function WizardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const meta = await fetchMeta(locale);

  return <WizardShell meta={meta}>{children}</WizardShell>;
}
