"use client";

import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWizardStore } from "@/lib/store/wizard";
import { cn } from "@/lib/utils";
import {
  checkStudentIdentifier,
  type StudentIdFailureReason,
} from "@/lib/validation/student-id";

import { StepPage } from "./step-page";

/**
 * Message id per failure reason. `format` covers "neither a RUN nor an IPE",
 * which is exactly what `errors.invalidStudentId` describes; a well-formed RUN
 * body with the wrong verifier gets the specific check-digit message.
 */
const FAILURE_KEY = {
  empty: "student.idRequiredHint",
  format: "errors.invalidStudentId",
  check_digit: "errors.invalidRunCheckDigit",
} as const satisfies Record<StudentIdFailureReason, string>;

/**
 * Step 1 — identify the student (MIGRATION.md §4.1).
 *
 * Phase 2 ships only the identifier field: it is what the step guard gates on,
 * so it has to work before the rest of the step (the "why do we ask" popover,
 * the list-exists radio and the ties switch) is built in Phase 3.
 *
 * The pre-check is display-only. `@/lib/validation/student-id` mirrors
 * `normalize_student_identifier` so Continue can enable without a round trip,
 * but the engine re-validates the identifier on `/simulate` and the API's 422
 * message is what the family finally sees.
 *
 * Privacy (§4.5): the value lives in the store's memory-only slice — never
 * persisted, never in the URL, and `autoComplete="off"` keeps the browser from
 * filling or remembering it.
 */
export function StudentStep() {
  const t = useTranslations();

  const studentId = useWizardStore((state) => state.studentId);
  const setStudentId = useWizardStore((state) => state.setStudentId);

  const check = checkStudentIdentifier(studentId);
  const isEmpty = !check.ok && check.reason === "empty";
  const hasError = !check.ok && !isEmpty;

  return (
    <StepPage slug="student">
      <div className="flex flex-col gap-2">
        <Label htmlFor="student-id">{t("student.idLabel")}</Label>
        <Input
          id="student-id"
          name="student-id"
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
          placeholder={t("student.idPlaceholder")}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={hasError || undefined}
          aria-describedby="student-id-feedback student-id-help"
        />
        <p
          id="student-id-feedback"
          // `role="status"` already implies `aria-live="polite"`.
          role="status"
          data-testid="student-id-feedback"
          data-state={check.ok ? "valid" : isEmpty ? "empty" : "invalid"}
          className={cn(
            "flex items-start gap-1.5 text-sm",
            // Green for accepted, red for rejected. shadcn has no `success`
            // token, hence a raw palette colour; the green/orange/red of the
            // *risk* badges is a different scale and comes from `/meta`
            // thresholds in Phase 4 (MIGRATION.md §4.4).
            check.ok && "text-emerald-600 dark:text-emerald-400",
            hasError && "text-destructive",
            isEmpty && "text-muted-foreground",
          )}
        >
          {check.ok ? (
            <CircleCheckIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          ) : null}
          {hasError ? (
            <CircleAlertIcon
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          ) : null}
          {check.ok ? t("student.idValid") : t(FAILURE_KEY[check.reason])}
        </p>
        <p id="student-id-help" className="text-xs text-muted-foreground">
          {t("student.idHelp")}
        </p>
      </div>
    </StepPage>
  );
}
