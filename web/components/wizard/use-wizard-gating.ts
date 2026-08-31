"use client";

import { usePathname } from "@/i18n/navigation";

import { useMetaOptional } from "@/lib/meta";
import {
  selectCanContinue,
  selectCanEnterStep,
  useWizardStore,
  type StepGateOptions,
} from "@/lib/store/wizard";

import {
  STEP_SLUGS,
  stepFromPathname,
  stepNumber,
  type StepSlug,
} from "./steps";

/**
 * Binds the store's step gates (MIGRATION.md §4.1) to the current route.
 *
 * The rules themselves live in `@/lib/store/wizard`; this hook only decides
 * *which* step the URL is on, supplies `/meta.max_exact_equiv_permutations` and
 * `/meta.max_wishes` as the two server limits, and re-exposes the gates as plain booleans so every
 * component below takes props instead of touching the store.
 *
 * Each gate is a separate primitive subscription, so the shell re-renders only
 * when a gate actually flips — not on every keystroke in the wish list.
 */
export type WizardGating = {
  /** Current step slug; `student` when the pathname is not a wizard route. */
  slug: StepSlug;
  /** May the family be on this step right now? */
  allowed: boolean;
  /** Furthest enterable step — the guard's redirect target. */
  fallbackSlug: StepSlug;
  canEnter: (slug: StepSlug) => boolean;
  canContinue: boolean;
};

export function useWizardGating(): WizardGating {
  const pathname = usePathname();
  const meta = useMetaOptional();

  const slug = stepFromPathname(pathname ?? "") ?? "student";
  // Both server caps of §3, straight from `/meta`, so every gate the shell
  // draws — the stepper links, Continue, and the guard's fallback — uses the
  // numbers the API will enforce, and does so from the first render rather than
  // waiting for some step to have called `setMaxWishes`.
  const options: StepGateOptions = {
    maxOrders: meta?.max_exact_equiv_permutations ?? null,
    maxWishes: meta?.max_wishes ?? null,
  };

  // Step 1 is always enterable (§4.1), so only 2–4 need a subscription.
  const canEnterList = useWizardStore(selectCanEnterStep(2, options));
  const canEnterResult = useWizardStore(selectCanEnterStep(3, options));
  const canEnterImprove = useWizardStore(selectCanEnterStep(4, options));
  const canContinueHere = useWizardStore(
    selectCanContinue(stepNumber(slug), options),
  );

  const entry: Record<StepSlug, boolean> = {
    student: true,
    list: canEnterList,
    result: canEnterResult,
    improve: canEnterImprove,
  };

  // `lastAllowedStep` from the store needs the whole state object; the same
  // answer falls out of the four booleans already subscribed to.
  let fallbackSlug: StepSlug = "student";
  for (const candidate of STEP_SLUGS) {
    if (!entry[candidate]) break;
    fallbackSlug = candidate;
  }

  return {
    slug,
    allowed: entry[slug],
    fallbackSlug,
    canEnter: (candidate) => entry[candidate],
    canContinue: canContinueHere,
  };
}
