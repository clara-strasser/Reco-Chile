"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "@/i18n/navigation";

import { stepPath, type StepSlug } from "./steps";

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
 */
export function StepGuard({
  allowed,
  fallbackSlug,
  children,
}: {
  allowed: boolean;
  fallbackSlug: StepSlug;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const target = stepPath(fallbackSlug);

  React.useEffect(() => {
    if (!allowed) router.replace(target);
  }, [allowed, router, target]);

  if (allowed) return <>{children}</>;

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
