/**
 * Step 1 of the wizard — identify the student (MIGRATION.md §4.1 row 1).
 *
 * Only the assembled step is public: the field, the two mode controls, the
 * estimate caveat and the privacy note are parts of this step and of no other,
 * so they stay module-private and are reached through `StudentStep`.
 */
export { StudentStep } from "./student-step";
