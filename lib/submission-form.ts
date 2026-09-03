export const SUBMISSION_FIELD_TYPES = ["TEXT", "TEXTAREA", "PHONE", "EMAIL", "URL", "FILE", "SELECT", "CHECKBOX"] as const;
export type SubmissionFieldType = (typeof SUBMISSION_FIELD_TYPES)[number];
export type SubmissionFieldStage = "CONTACT" | "CONTEXT";
export type SubmissionFieldScope = "ALL" | "COMMERCIAL" | "NON_COMMERCIAL";
export type SubmissionFieldSemantic = "CONTACT_NAME" | "CONTACT_COMPANY" | "CONTACT_EMAIL" | "CONTACT_PHONE" | "COMMENT" | "LINKS" | "FILES" | "CUSTOM";

export type SubmissionFormField = {
  id: string;
  stage: SubmissionFieldStage;
  type: SubmissionFieldType;
  scope: SubmissionFieldScope;
  semantic: SubmissionFieldSemantic;
  label: string;
  description: string;
  placeholder: string;
  required: boolean;
  options: string[];
  sortOrder: number;
};

export const DEFAULT_SUBMISSION_FORM_FIELDS: SubmissionFormField[] = [
  { id: "contact-name", stage: "CONTACT", type: "TEXT", scope: "ALL", semantic: "CONTACT_NAME", label: "Имя или название результата", description: "Для лидов и сделок — имя потенциального клиента; для других заданий — название выполненного результата.", placeholder: "Введите имя или название", required: true, options: [], sortOrder: 0 },
  { id: "contact-company", stage: "CONTACT", type: "TEXT", scope: "COMMERCIAL", semantic: "CONTACT_COMPANY", label: "Компания", description: "Компания потенциального клиента, если она известна.", placeholder: "Название компании", required: false, options: [], sortOrder: 1 },
  { id: "contact-email", stage: "CONTACT", type: "EMAIL", scope: "COMMERCIAL", semantic: "CONTACT_EMAIL", label: "Рабочий email", description: "Рабочая почта потенциального клиента.", placeholder: "name@company.kz", required: false, options: [], sortOrder: 2 },
  { id: "contact-phone", stage: "CONTACT", type: "PHONE", scope: "COMMERCIAL", semantic: "CONTACT_PHONE", label: "Телефон", description: "Номер для связи с потенциальным клиентом.", placeholder: "+7 777 000 00 00", required: true, options: [], sortOrder: 3 },
  { id: "partner-comment", stage: "CONTEXT", type: "TEXTAREA", scope: "ALL", semantic: "COMMENT", label: "Комментарий компании", description: "Почему результат подходит и что уже сделано.", placeholder: "Коротко опишите контекст и договорённости", required: false, options: [], sortOrder: 4 },
  { id: "external-links", stage: "CONTEXT", type: "TEXTAREA", scope: "ALL", semantic: "LINKS", label: "Ссылки", description: "Публикация, страница события или другой результат — по одной ссылке в строке.", placeholder: "https://example.com", required: false, options: [], sortOrder: 5 },
  { id: "files", stage: "CONTEXT", type: "FILE", scope: "ALL", semantic: "FILES", label: "Файлы", description: "До 5 файлов, каждый до 10 МБ.", placeholder: "", required: false, options: [], sortOrder: 6 },
];

const stages = new Set<SubmissionFieldStage>(["CONTACT", "CONTEXT"]);
const scopes = new Set<SubmissionFieldScope>(["ALL", "COMMERCIAL", "NON_COMMERCIAL"]);
const semantics = new Set<SubmissionFieldSemantic>(["CONTACT_NAME", "CONTACT_COMPANY", "CONTACT_EMAIL", "CONTACT_PHONE", "COMMENT", "LINKS", "FILES", "CUSTOM"]);
const types = new Set<SubmissionFieldType>(SUBMISSION_FIELD_TYPES);

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function normalizeSubmissionFormFields(value: unknown, options: { preserveSystemOmissions?: boolean } = {}): SubmissionFormField[] {
  if (!Array.isArray(value) || (value.length === 0 && !options.preserveSystemOmissions)) return DEFAULT_SUBMISSION_FORM_FIELDS.map((field) => ({ ...field, options: [...field.options] }));
  const normalized = value.slice(0, 24).map((raw, index) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const semantic = semantics.has(item.semantic as SubmissionFieldSemantic) ? item.semantic as SubmissionFieldSemantic : "CUSTOM";
    const fallback = DEFAULT_SUBMISSION_FORM_FIELDS.find((field) => field.semantic === semantic);
    const type = types.has(item.type as SubmissionFieldType) ? item.type as SubmissionFieldType : fallback?.type ?? "TEXT";
    return {
      id: text(item.id, 80) || fallback?.id || `custom-${crypto.randomUUID()}`,
      stage: stages.has(item.stage as SubmissionFieldStage) ? item.stage as SubmissionFieldStage : fallback?.stage ?? "CONTEXT",
      type,
      scope: scopes.has(item.scope as SubmissionFieldScope) ? item.scope as SubmissionFieldScope : fallback?.scope ?? "ALL",
      semantic,
      label: text(item.label, 120) || fallback?.label || "Новое поле",
      description: text(item.description, 280),
      placeholder: text(item.placeholder, 180),
      required: item.required === true,
      options: Array.isArray(item.options) ? item.options.map((option) => text(option, 80)).filter(Boolean).slice(0, 12) : [],
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
    } satisfies SubmissionFormField;
  });

  const seenIds = new Set<string>();
  const seenSystemSemantics = new Set<SubmissionFieldSemantic>();
  const unique = normalized
    .filter((field) => {
      if (seenIds.has(field.id)) return false;
      if (field.semantic !== "CUSTOM" && seenSystemSemantics.has(field.semantic)) return false;
      seenIds.add(field.id);
      if (field.semantic !== "CUSTOM") seenSystemSemantics.add(field.semantic);
      return true;
    });
  const complete = options.preserveSystemOmissions
    ? unique
    : [...DEFAULT_SUBMISSION_FORM_FIELDS.map((fallback) => unique.find((field) => field.semantic === fallback.semantic) ?? { ...fallback, options: [...fallback.options] }), ...unique.filter((field) => field.semantic === "CUSTOM")];
  return complete
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((field, index) => ({ ...field, sortOrder: index }));
}

export function submissionFormError(fields: SubmissionFormField[], missionTypes: string[]) {
  const requiredName = fields.some((field) => field.semantic === "CONTACT_NAME" && field.required);
  if (!requiredName) return "Поле имени или названия результата должно остаться обязательным.";
  const hasCommercialMission = missionTypes.some((type) => type === "LEAD" || type === "DEAL");
  const requiredContact = fields.some((field) => (field.semantic === "CONTACT_PHONE" || field.semantic === "CONTACT_EMAIL") && field.required);
  if (hasCommercialMission && !requiredContact) return "Для лидов и сделок оставьте обязательным телефон или email клиента.";
  return "";
}

export function parseSubmissionFormFields(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed as { version?: unknown }).version === 2) {
      return normalizeSubmissionFormFields((parsed as { fields?: unknown }).fields, { preserveSystemOmissions: true });
    }
    return normalizeSubmissionFormFields(parsed);
  }
  catch { return normalizeSubmissionFormFields([]); }
}

export function serializeSubmissionFormFields(fields: SubmissionFormField[]) {
  return JSON.stringify({ version: 2, fields: normalizeSubmissionFormFields(fields, { preserveSystemOmissions: true }) });
}

export function visibleSubmissionFormFields(fields: SubmissionFormField[], missionType: string) {
  const commercial = missionType === "LEAD" || missionType === "DEAL";
  return fields.filter((field) => field.scope === "ALL" || (commercial ? field.scope === "COMMERCIAL" : field.scope === "NON_COMMERCIAL"));
}
