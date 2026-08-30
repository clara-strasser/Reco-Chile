/**
 * Compatibility re-export.
 *
 * The step itself moved to `@/components/student` when Phase 3 grew it past a
 * single field; this module keeps the Phase 2 import path working for
 * `app/[locale]/(wizard)/student/page.tsx` and for anything else that already
 * pointed at `components/wizard/student-step`.
 */
export { StudentStep } from "@/components/student";
