import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SUBMISSION_FORM_FIELDS, normalizeSubmissionFormFields, parseSubmissionFormFields, serializeSubmissionFormFields, submissionFormError } from "../lib/submission-form.ts";

test("program form keeps intentional field deletions after normalization", () => {
  const retained = DEFAULT_SUBMISSION_FORM_FIELDS.filter((field) => !["CONTACT_COMPANY", "FILES"].includes(field.semantic));
  const normalized = parseSubmissionFormFields(serializeSubmissionFormFields(retained));
  assert.deepEqual(normalized.map((field) => field.semantic), retained.map((field) => field.semantic));
  assert.equal(normalized.some((field) => field.semantic === "CONTACT_COMPANY"), false);
  assert.equal(normalized.some((field) => field.semantic === "FILES"), false);
});

test("legacy empty form still receives safe defaults", () => {
  assert.deepEqual(normalizeSubmissionFormFields([]).map((field) => field.semantic), DEFAULT_SUBMISSION_FORM_FIELDS.map((field) => field.semantic));
});

test("legacy partial form data is completed without reviving versioned deletions", () => {
  const custom = [{ id: "course", label: "Course", type: "TEXT", semantic: "CUSTOM", required: true }];
  assert.equal(parseSubmissionFormFields(JSON.stringify(custom)).some((field) => field.semantic === "CONTACT_PHONE"), true);
  assert.equal(parseSubmissionFormFields(JSON.stringify({ version: 2, fields: custom })).some((field) => field.semantic === "CONTACT_PHONE"), false);
});

test("commercial forms require a name and at least one required contact", () => {
  const fields = DEFAULT_SUBMISSION_FORM_FIELDS.map((field) => ({ ...field }));
  assert.equal(submissionFormError(fields, ["LEAD"]), "");
  assert.match(submissionFormError(fields.filter((field) => field.semantic !== "CONTACT_NAME"), ["LEAD"]), /имени/);
  assert.match(submissionFormError(fields.map((field) => ({ ...field, required: field.semantic === "CONTACT_NAME" })), ["DEAL"]), /телефон или email/);
  assert.equal(submissionFormError(fields.filter((field) => field.semantic !== "CONTACT_PHONE"), ["IMAGE"]), "");
});
