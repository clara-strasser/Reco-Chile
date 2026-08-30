import { ResultStep } from "@/components/result/result-step";

/** Step 3 — `/[locale]/result`. Runs `/simulate` on entry when the stored
 *  result is stale (MIGRATION.md §4.1) and renders the prototype's section 3. */
export default function ResultPage() {
  return <ResultStep />;
}
