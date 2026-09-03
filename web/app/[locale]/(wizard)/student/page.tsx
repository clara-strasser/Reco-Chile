import { StudentStep } from "@/components/student";

/** Step 1 — `/[locale]/student`. Gated on the welcome answer and the
 *  disclaimer's consent checkbox (MIGRATION.md §4.1, §9b item 2). */
export default function StudentPage() {
  return <StudentStep />;
}
