"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";
import { useWizardStore } from "@/lib/store/wizard";

import { stepNumber, stepPath, type StepSlug } from "./steps";

/**
 * Deep-link guard for the wizard routes (MIGRATION.md §4.1: "Deep-linking to a
 * locked step redirects to the last allowed step. The step guard lives in the
 * `(wizard)/layout.tsx`").
 *
 * The state it gates on is client-only — `studentId` and `simulation` are never
 * persisted (§4.2 privacy posture), so the server cannot know whether a step is
 * reachable and this cannot be a middleware redirect. `router.replace` keeps the
 * locked URL out of the history stack, so Back does not bounce into it again.
 *
 * While the redirect is in flight the locked step's content is replaced by a
 * skeleton: rendering `children` would flash a step the family may not enter and
 * would fire its data hooks.
 *
 * ## Navigations the wizard starts itself
 *
 * The guard reacts to *state*, not to intent, and one flow of §4.2 deliberately
 * makes the current step illegal on purpose: step 4's "Add selected and review"
 * appends the recommendations — which invalidates the simulation and therefore
 * locks step 4 — and then pushes to step 2. Left alone, this effect would see
 * the lock first and `router.replace` to step 3, the furthest step still
 * reachable, cancelling the push.
 *
 * So the producer sets `pendingNavigation` to its destination *before* it
 * mutates the store, and this guard stands down while that flag is set: the
 * wizard is already on its way somewhere legal. `children` keep rendering
 * meanwhile — the family looks at the page they pressed the button on until the
 * router swaps it — and the destination clears the flag when it mounts
 * (`ListStep`), with the arrival check below as the backstop for any other
 * target.
 */
export function StepGuard({
  slug,
  allowed,
  fallbackSlug,
  children,
}: {
  /** The step the URL is on — needed to recognise the arrival of a wizard-owned
   *  navigation, not just to decide whether it is allowed. */
  slug: StepSlug;
  allowed: boolean;
  fallbackSlug: StepSlug;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const target = stepPath(fallbackSlug);

  const pendingNavigation = useWizardStore((state) => state.pendingNavigation);
  const setPendingNavigation = useWizardStore(
    (state) => state.setPendingNavigation,
  );

  // Arrived: whatever the destination was, the hand-off is over and the guard
  // takes charge again. `ListStep` does the same on mount — the two are
  // idempotent, and having both means neither the only destination today nor a
  // future one can leave the guard switched off.
  const arrived = pendingNavigation === stepNumber(slug);
  React.useEffect(() => {
    if (arrived) setPendingNavigation(null);
  }, [arrived, setPendingNavigation]);

  const suppressed = pendingNavigation !== null && !arrived;

  React.useEffect(() => {
    if (!allowed && !suppressed) router.replace(target);
  }, [allowed, suppressed, router, target]);

  if (allowed || suppressed) return <>{children}</>;

  return (
    <div
      className="flex flex-col gap-3"
      // Transient redirect state, not content: nothing to announce.
      aria-hidden="true"
      data-testid="wizard-step-guard-redirect"
    >
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}
