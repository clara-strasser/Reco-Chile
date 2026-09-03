"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { STEP_LEAD_KEY, STEP_TITLE_KEY, type StepSlug } from "./steps";

/**
 * Shared frame for a wizard step: the numbered title and the one sentence of
 * prototype copy that orients the family, followed by the step body.
 *
 * The step title is the page's single `<h1>`. The application title in
 * `app/[locale]/layout.tsx` is deliberately a `<p>` brand element and not a
 * heading: it repeats on every route, so making it the `<h1>` would leave every
 * step announced under the same, uninformative document heading. Everything
 * below opens at `<h2>` — a screen reader navigates by that outline, and a step
 * that jumps straight to `<h3>` reads as if a section were missing.
 *
 * Single column throughout — the prototype is `layout="centered"`, and the
 * centred column with its max width comes from the locale layout, so this
 * component never sets a width of its own.
 */
export function StepPage({
  slug,
  lead,
  leadTestId,
  children,
}: {
  slug: StepSlug;
  /**
   * Replaces the step's static lead sentence. Step 2 needs it because its
   * caption depends on whether the family already has a list, which a fixed
   * `STEP_LEAD_KEY` entry cannot express. Pass `null` to show no lead line at
   * all (step 1, MIGRATION.md §9b: that sentence moved into the "Why do we ask
   * for this?" popover instead of sitting under the heading).
   */
  lead?: React.ReactNode | null;
  leadTestId?: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations();
  const heading = useStepHeadingFocus(slug);
  const resolvedLead = lead === undefined ? t(STEP_LEAD_KEY[slug]) : lead;

  return (
    <section className="flex flex-col gap-6" data-testid={`step-${slug}`}>
      <header className="flex flex-col gap-2">
        <h1
          ref={heading}
          // Focus target, not a tab stop: `-1` lets the wizard move focus here
          // after a step change without adding a stop to the Tab order.
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight text-balance focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {t(STEP_TITLE_KEY[slug])}
        </h1>
        {resolvedLead === null ? null : (
          <p
            className="text-sm text-pretty text-muted-foreground"
            data-testid={leadTestId}
          >
            {resolvedLead}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

/**
 * The last step this document rendered.
 *
 * Module scope, deliberately: it has to survive the unmount of one step page
 * and the mount of the next, which is exactly what a React ref or state cannot
 * do. A full page load resets it, which is the distinction that matters — see
 * below.
 */
let renderedSlug: StepSlug | null = null;

/**
 * Move focus to the step's `<h1>` after a step change (MIGRATION.md §7, Phase 6
 * "focus order").
 *
 * The wizard is a client-side router: pressing Continue or Back replaces the
 * page under a shell that never unmounts, so without this the focused element
 * is a button that no longer exists. A screen reader then announces nothing at
 * all, and the next Tab starts over from the top of the document.
 *
 * A *first* load must not steal focus — the family has not navigated anywhere,
 * and hijacking focus on arrival is its own bug — which is why the trigger is
 * "the step changed since the last one this document rendered", not "this
 * component mounted". Comparing slugs rather than counting mounts also makes it
 * idempotent under React's development double-invoke, and it leaves the locale
 * switcher alone: `/es/list` and `/en/list` are the same step, so switching
 * language keeps the family where they were.
 */
function useStepHeadingFocus(
  slug: StepSlug,
): React.RefObject<HTMLHeadingElement | null> {
  const heading = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    const previous = renderedSlug;
    renderedSlug = slug;
    if (previous === null || previous === slug) return;
    heading.current?.focus();
  }, [slug]);

  return heading;
}
