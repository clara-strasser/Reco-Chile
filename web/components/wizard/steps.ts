/**
 * Route-level identity of the four wizard steps: slug ↔ number ↔ href.
 *
 * The *rules* (can-enter / can-continue) are NOT here — they live in
 * `@/lib/store/wizard` (`canEnterStep`, `canContinue`, `lastAllowedStep`) next
 * to the state they read, and `use-wizard-gating.ts` binds them to the router.
 * This module only translates between the store's numeric `WizardStep`
 * (`1 | 2 | 3 | 4`) and the URL slugs of MIGRATION.md §2.1, and is deliberately
 * free of React so it can be unit-tested and used from server components.
 */

import type { WizardStep } from "@/lib/store/wizard";

/** URL slugs, in wizard order — `app/[locale]/(wizard)/<slug>/page.tsx`. */
export const STEP_SLUGS = ["student", "list", "result", "improve"] as const;

export type StepSlug = (typeof STEP_SLUGS)[number];

/**
 * Message ids, from `messages/{es,en}.json`.
 *
 * `steps.*` holds the short stepper labels; each step's own namespace holds its
 * page title. The lead sentence is the one line of existing prototype copy that
 * orients the family on that step — deliberately reused rather than newly
 * written, so the wizard says what the Streamlit app says.
 */
/** Leaf ids inside the `steps` namespace. */
export const STEP_LABEL_KEY = {
  student: "student",
  list: "list",
  result: "result",
  improve: "improve",
} as const satisfies Record<StepSlug, string>;

export const STEP_TITLE_KEY = {
  student: "student.title",
  list: "list.title",
  result: "result.title",
  improve: "improve.title",
} as const satisfies Record<StepSlug, string>;

export const STEP_LEAD_KEY = {
  // "Why do we ask for this?" — the reason the identifier is needed at all.
  student: "student.why.body",
  list: "list.order.preferenceHint",
  // "About this estimate" — the caveat the prototype shows beside the result.
  result: "app.aboutEstimate.body",
  improve: "improve.methodBody",
} as const satisfies Record<StepSlug, string>;

export function isStepSlug(value: string): value is StepSlug {
  return (STEP_SLUGS as readonly string[]).includes(value);
}

/** The store's 1-based step number for a slug. */
export function stepNumber(slug: StepSlug): WizardStep {
  return (STEP_SLUGS.indexOf(slug) + 1) as WizardStep;
}

export function stepSlug(step: WizardStep): StepSlug {
  return STEP_SLUGS[step - 1];
}

/**
 * Locale-free path of a step. `Link` / `useRouter` from `@/i18n/navigation`
 * prepend the `[locale]` segment, so callers never hand-build `/es/student`.
 */
export function stepPath(slug: StepSlug): string {
  return `/${slug}`;
}

/**
 * The wizard step a pathname points at, or `null` when the path is not a wizard
 * route. Tolerates a leading `[locale]` segment (as `next/navigation` reports
 * it) and a trailing slash.
 */
export function stepFromPathname(pathname: string): StepSlug | null {
  const last = pathname.split("/").filter(Boolean).at(-1);
  return last !== undefined && isStepSlug(last) ? last : null;
}

/** The slug a Continue press moves to, or `null` on the terminal step. */
export function nextSlug(slug: StepSlug): StepSlug | null {
  return STEP_SLUGS[STEP_SLUGS.indexOf(slug) + 1] ?? null;
}

/** The slug a Back press moves to, or `null` on the first step. */
export function previousSlug(slug: StepSlug): StepSlug | null {
  const index = STEP_SLUGS.indexOf(slug);
  return index > 0 ? STEP_SLUGS[index - 1] : null;
}
