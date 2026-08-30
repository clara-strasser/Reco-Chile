"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { STEP_LEAD_KEY, STEP_TITLE_KEY, type StepSlug } from "./steps";

/**
 * Shared frame for a wizard step: the numbered title and the one sentence of
 * prototype copy that orients the family, followed by the step body.
 *
 * The heading is an `<h2>`: `app/[locale]/layout.tsx` already owns the page's
 * single `<h1>` (the application title in the header).
 *
 * Single column throughout — the prototype is `layout="centered"`, and the
 * centred column with its max width comes from the locale layout, so this
 * component never sets a width of its own.
 */
export function StepPage({
  slug,
  children,
}: {
  slug: StepSlug;
  children?: React.ReactNode;
}) {
  const t = useTranslations();

  return (
    <section className="flex flex-col gap-6" data-testid={`step-${slug}`}>
      <header className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-balance">
          {t(STEP_TITLE_KEY[slug])}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {t(STEP_LEAD_KEY[slug])}
        </p>
      </header>
      {children}
    </section>
  );
}
