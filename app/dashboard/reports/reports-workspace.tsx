"use client";
/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/media-has-caption */
import { useMemo, useState } from "react";
import type { ReportField } from "../../../lib/reporting";
import { countRu } from "@/lib/format-display";
type Report = {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string;
  partnerPhone: string;
  programId: string | null;
  programName: string | null;
  periodStart: string;
  periodEnd: string;
  status: string;
  answers: Record<string, unknown>;
  metrics: Record<string, number>;
  transcript: string;
  companyComment: string;
  templateSnapshot: ReportField[];
  files: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    kind: string;
  }>;
  aiSummary: Record<string, unknown>;
  updatedAt: string;
};
const statusNames: Record<string, string> = {
  SUBMITTED: "Отправлен",
  VIEWED: "Просмотрен",
  NEEDS_CLARIFICATION: "Требует уточнения",
  ACCEPTED: "Принят",
  DRAFT: "Черновик",
};
const metricNames: Record<string, string> = {
  completedTasks: "Выполнено заданий",
  submissions: "Заявки",
  accepted: "Подтверждено",
  rejected: "Отклонено",
  leads: "Лиды",
  deals: "Сделки",
  accrued: "Начислено",
  paid: "Выплачено",
  pending: "К выплате",
  paidRewardsCount: "Выплат проведено",
  pendingRewardsCount: "Выплат ожидается",
};
const types: Record<string, string> = {
  TEXT: "Короткий текст",
  TEXTAREA: "Длинный текст",
  NUMBER: "Число / KPI",
  DATE: "Дата",
  SELECT: "Один вариант",
  MULTISELECT: "Несколько вариантов",
  URL: "Ссылка",
  FILE: "Файл",
  BOOLEAN: "Да / нет",
};
export function ReportsWorkspace({
  companyName,
  template,
  initialReports,
  overview,
  programs,
}: {
  companyName: string;
  template: { id: string; fields: ReportField[]; metrics: string[] };
  initialReports: Report[];
  overview: {
    total: number;
    submittedAgents: number;
    missingAgents: number;
    needsClarification: number;
    aggregate: Record<string, number>;
  };
  programs: Array<{ id: string; name: string }>;
}) {
  const [reports, setReports] = useState(initialReports);
  const [fields, setFields] = useState(template.fields);
  const [metrics, setMetrics] = useState(template.metrics);
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);
  const [filters, setFilters] = useState({
    query: "",
    program: "",
    status: "",
    audio: false,
    files: false,
  });
  const [notice, setNotice] = useState("");
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [statusPending, setStatusPending] = useState("");
  const [acceptedReport, setAcceptedReport] = useState<Report | null>(null);
  const visible = useMemo(
    () =>
      reports.filter(
        (item) =>
          (!filters.query ||
            `${item.partnerName} ${item.partnerEmail}`
              .toLowerCase()
              .includes(filters.query.toLowerCase())) &&
          (!filters.program || item.programId === filters.program) &&
          (!filters.status || item.status === filters.status) &&
          (!filters.audio ||
            item.files.some((file) => file.kind === "AUDIO")) &&
          (!filters.files ||
            item.files.some((file) => file.kind === "ATTACHMENT")),
      ),
    [reports, filters],
  );
  function updateField(id: string, patch: Partial<ReportField>) {
    setFields(
      fields.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    );
  }
  function move(index: number, delta: number) {
    const next = [...fields];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next.map((field, sortOrder) => ({ ...field, sortOrder })));
  }
  async function saveTemplate() {
    setPending(true);
    const response = await fetch("/api/company/reports", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "TEMPLATE", fields, metrics }),
    });
    const data = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      setNotice(data.error || "Ошибка сохранения");
      return;
    }
    setNotice("Форма отчёта сохранена. Уже отправленные отчёты не изменились.");
    setSettings(false);
  }
  async function status(report: Report, next: string, comment = "") {
    setStatusPending(report.id);
    setNotice("");
    try {
      const response = await fetch("/api/company/reports", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "STATUS", reportId: report.id, status: next, comment }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось обновить отчёт");
      const updated = { ...report, status: next, companyComment: comment };
      setReports((current) => current.map((item) => (item.id === report.id ? updated : item)));
      setSelected(updated);
      if (next === "ACCEPTED") setAcceptedReport(updated);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось обновить отчёт");
    } finally {
      setStatusPending("");
    }
  }
  async function analyze() {
    setPending(true);
    setNotice("");
    const response = await fetch("/api/company/reports/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await response.json()) as {
      analysis?: Record<string, unknown>;
      error?: string;
    };
    setPending(false);
    if (!response.ok) setNotice(data.error || "Не удалось выполнить анализ");
    else setAnalysis(data.analysis || null);
  }
  return (
    <div className="dashboard-content reports-workspace">
      <div className="module-heading">
        <div>
          <span className="module-kicker">ОТЧЁТЫ АГЕНТОВ</span>
          <h1>Работа команды в динамике</h1>
          <p>
            Отчёты, реальные показатели из RiseStaff и повторяющиеся сигналы — без
            ручных таблиц.
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() => setSettings(true)}
        >
          Настроить форму
        </button>
      </div>
      <section className="reports-metrics">
        <article>
          <small>ОТЧЁТОВ</small>
          <strong>{overview.total}</strong>
        </article>
        <article>
          <small>СДАЛИ</small>
          <strong>{overview.submittedAgents}</strong>
        </article>
        <article>
          <small>НЕ СДАЛИ</small>
          <strong>{overview.missingAgents}</strong>
        </article>
        <article>
          <small>НУЖНО УТОЧНИТЬ</small>
          <strong>{overview.needsClarification}</strong>
        </article>
      </section>
      <section className="report-kpi-strip">
        {Object.entries(overview.aggregate)
          .filter(([, value]) => value)
          .map(([key, value]) => (
            <span key={key}>
              <small>{metricNames[key] || key}</small>
              <b>
                {["accrued", "paid", "pending"].includes(key)
                  ? `${value.toLocaleString("ru-RU")} ₸`
                  : value}
              </b>
            </span>
          ))}
      </section>
      <section className="reports-ai-panel">
        <div>
          <small>НАКОПИТЕЛЬНАЯ АНАЛИТИКА</small>
          <h2>RiseStaff помнит выводы, а не пересылает всю историю</h2>
          <p>
            Анализ строится только по сохранённым отчётам и показателям. Каждый
            вывод содержит основание.
          </p>
        </div>
        <button onClick={() => void analyze()} disabled={pending}>
          {pending ? "Анализируем…" : "Проанализировать отчёты ✦"}
        </button>
        {analysis && (
          <div className="reports-ai-output">
            <strong>{String(analysis.summary || "")}</strong>
            {[
              "trends",
              "blockers",
              "achievements",
              "companyRecommendations",
            ].map((key) => (
              <section key={key}>
                <small>
                  {key === "trends"
                    ? "ДИНАМИКА"
                    : key === "blockers"
                      ? "БЛОКЕРЫ"
                      : key === "achievements"
                        ? "ДОСТИЖЕНИЯ"
                        : "РЕКОМЕНДАЦИИ"}
                </small>
                {(Array.isArray(analysis[key])
                  ? (analysis[key] as string[])
                  : []
                ).map((item) => (
                  <p key={item}>• {item}</p>
                ))}
              </section>
            ))}
          </div>
        )}
      </section>
      <div className="reports-filters">
        <input
          placeholder="Найти агента"
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
        />
        <select
          value={filters.program}
          onChange={(e) => setFilters({ ...filters, program: e.target.value })}
        >
          <option value="">Все программы</option>
          {programs.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Все статусы</option>
          {Object.entries(statusNames)
            .filter(([key]) => key !== "DRAFT")
            .map(([key, value]) => (
              <option value={key} key={key}>
                {value}
              </option>
            ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={filters.audio}
            onChange={(e) =>
              setFilters({ ...filters, audio: e.target.checked })
            }
          />{" "}
          С аудио
        </label>
        <label>
          <input
            type="checkbox"
            checked={filters.files}
            onChange={(e) =>
              setFilters({ ...filters, files: e.target.checked })
            }
          />{" "}
          С файлами
        </label>
      </div>
      <div className="company-report-grid">
        {visible
          .filter((item) => item.status !== "DRAFT")
          .map((report) => (
            <article
              key={report.id}
              onClick={() => setSelected(report)}
            >
              <header>
                <span>{statusNames[report.status]}</span>
                <time>
                  {report.periodStart} — {report.periodEnd}
                </time>
              </header>
              <h3>{report.partnerName}</h3>
              <small>{report.programName || "Все программы"}</small>
              <p>
                {String(
                  report.answers.main_results ||
                    report.answers.work_done ||
                    report.transcript ||
                    "Без текстового превью",
                ).slice(0, 180)}
              </p>
              <footer>
                <b>{countRu(report.files.length, "файл", "файла", "файлов")}</b>
                <b>
                  {Object.values(report.metrics).filter(Boolean).length}{" "}
                  показателей
                </b>
                <i>Открыть →</i>
              </footer>
            </article>
          ))}
      </div>
      {notice && <div className="inline-notice">{notice}</div>}
      {selected && (
        <div className="report-sheet-backdrop">
          <section className="report-sheet company-report-detail">
            <header>
              <div>
                <small>{statusNames[selected.status]}</small>
                <h2>{selected.partnerName}</h2>
                <p>
                  {selected.periodStart} — {selected.periodEnd} ·{" "}
                  {selected.programName}
                </p>
              </div>
              <button onClick={() => setSelected(null)}>×</button>
            </header>
            <section className="report-period-summary">
              <div><small>АВТОМАТИЧЕСКАЯ СВОДКА</small><h3>Показатели кабинета за период отчёта</h3><p>{selected.periodStart} — {selected.periodEnd}. Данные рассчитаны системой, агент их не вводил.</p></div>
              <div className="report-detail-metrics">
                <span><small>РЕЗУЛЬТАТОВ</small><strong>{selected.metrics.submissions || 0}</strong></span>
                <span><small>ВЫПЛАТ ПРОВЕДЕНО</small><strong>{selected.metrics.paidRewardsCount || 0}</strong></span>
                <span><small>ОЖИДАЕТ ОПЛАТЫ</small><strong>{(selected.metrics.pending || 0).toLocaleString("ru-RU")} ₸</strong></span>
                <span><small>ВЫПЛАЧЕНО</small><strong>{(selected.metrics.paid || 0).toLocaleString("ru-RU")} ₸</strong></span>
              </div>
            </section>
            <div className="report-detail-answers">
              {selected.templateSnapshot
                .filter(
                  (field) =>
                    field.enabled !== false &&
                    selected.answers[field.id] !== undefined,
                )
                .map((field) => (
                  <article key={field.id}>
                    <small>{field.label}</small>
                    <p>
                      {String(selected.answers[field.id] || "Не заполнено")}
                    </p>
                  </article>
                ))}
            </div>
            {selected.transcript && (
              <details>
                <summary>Расшифровка полного отчёта</summary>
                <p>{selected.transcript}</p>
              </details>
            )}
            <div className="report-detail-files">
              {selected.files.map((file) =>
                file.kind === "AUDIO" ? (
                  <div key={file.id}>
                    <audio
                      controls
                      src={`/api/company/reports/${selected.id}/files/${file.id}?inline=1`}
                    />
                    <a
                      href={`/api/company/reports/${selected.id}/files/${file.id}`}
                    >
                      Скачать аудио
                    </a>
                  </div>
                ) : (
                  <a
                    key={file.id}
                    href={`/api/company/reports/${selected.id}/files/${file.id}`}
                  >
                    {file.fileName} ↓
                  </a>
                ),
              )}
            </div>
            <footer>
              <button
                type="button"
                onClick={() => {
                  const comment = prompt("Что агенту нужно уточнить?") || "";
                  if (comment)
                    void status(selected, "NEEDS_CLARIFICATION", comment);
                }}
              >
                Запросить уточнение
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={statusPending === selected.id || selected.status === "ACCEPTED"}
                onClick={() => void status(selected, "ACCEPTED")}
              >
                {statusPending === selected.id ? "Принимаем…" : selected.status === "ACCEPTED" ? "Отчёт принят" : "Принять отчёт"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {acceptedReport && (
        <div className="report-accepted-backdrop" role="presentation">
          <section className="report-accepted-dialog" role="dialog" aria-modal="true" aria-labelledby="report-accepted-title">
            <i>✓</i><small>ГОТОВО</small><h2 id="report-accepted-title">Отчёт принят</h2><p>{acceptedReport.partnerName} увидит новый статус в кабинете. Можно сразу подтвердить это в WhatsApp.</p>
            <div>{acceptedReport.partnerPhone ? <a href={`https://wa.me/${acceptedReport.partnerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Здравствуйте, ${acceptedReport.partnerName}! Это команда ${companyName}. Ваш отчёт за ${acceptedReport.periodStart} — ${acceptedReport.periodEnd} принят. Спасибо, данные и показатели сохранены в RiseStaff.`)}`} target="_blank" rel="noreferrer">Написать агенту в WhatsApp ↗</a> : <span>Телефон агента не указан</span>}<button type="button" onClick={() => setAcceptedReport(null)}>Закрыть</button></div>
          </section>
        </div>
      )}
      {settings && (
        <div className="report-sheet-backdrop">
          <section className="report-sheet report-template-editor">
            <header>
              <div>
                <small>КОНСТРУКТОР</small>
                <h2>Форма отчёта</h2>
                <p>Изменения применятся только к новым отчётам.</p>
              </div>
              <button onClick={() => setSettings(false)}>×</button>
            </header>
            <div className="template-field-list">
              {fields.map((field, index) => (
                <article key={field.id}>
                  <div className="field-order">
                    <button onClick={() => move(index, -1)}>↑</button>
                    <button onClick={() => move(index, 1)}>↓</button>
                  </div>
                  <div>
                    <input
                      value={field.label}
                      onChange={(e) =>
                        updateField(field.id, { label: e.target.value })
                      }
                    />
                    <input
                      value={field.description}
                      placeholder="Подсказка агенту"
                      onChange={(e) =>
                        updateField(field.id, { description: e.target.value })
                      }
                    />
                    <div>
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateField(field.id, {
                            type: e.target.value as ReportField["type"],
                          })
                        }
                      >
                        {Object.entries(types).map(([key, value]) => (
                          <option value={key} key={key}>
                            {value}
                          </option>
                        ))}
                      </select>
                      {field.type === "NUMBER" && (
                        <>
                          <input
                            value={field.unit || ""}
                            placeholder="Единица"
                            onChange={(e) =>
                              updateField(field.id, { unit: e.target.value })
                            }
                          />
                          <input
                            value={field.frequency || ""}
                            placeholder="Напр. ежедневно"
                            onChange={(e) =>
                              updateField(field.id, {
                                frequency: e.target.value,
                              })
                            }
                          />
                        </>
                      )}
                      {["SELECT", "MULTISELECT"].includes(field.type) && (
                        <input
                          value={field.options.join(", ")}
                          placeholder="Варианты через запятую"
                          aria-label={`Варианты поля ${field.label}`}
                          onChange={(event) =>
                            updateField(field.id, {
                              options: event.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean)
                                .slice(0, 20),
                            })
                          }
                        />
                      )}
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        checked={field.enabled}
                        onChange={(e) =>
                          updateField(field.id, { enabled: e.target.checked })
                        }
                      />{" "}
                      Показывать
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) =>
                          updateField(field.id, { required: e.target.checked })
                        }
                      />{" "}
                      Обязательное
                    </label>
                  </div>
                  <button
                    className="delete-field"
                    onClick={() =>
                      setFields(fields.filter((item) => item.id !== field.id))
                    }
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
            <button
              className="add-template-field"
              onClick={() =>
                setFields([
                  ...fields,
                  {
                    id: crypto.randomUUID(),
                    label: "Новый показатель",
                    description: "",
                    type: "NUMBER",
                    required: false,
                    enabled: true,
                    options: [],
                    unit: "",
                    frequency: "ежедневно",
                    sortOrder: fields.length,
                  },
                ])
              }
            >
              ＋ Добавить поле или KPI
            </button>
            <section className="template-metrics">
              <h3>Автоматические показатели</h3>
              {Object.entries(metricNames).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={metrics.includes(key)}
                    onChange={(e) =>
                      setMetrics(
                        e.target.checked
                          ? [...metrics, key]
                          : metrics.filter((item) => item !== key),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </section>
            <footer>
              <button onClick={() => setSettings(false)}>Отмена</button>
              <button
                className="button button-primary"
                disabled={pending}
                onClick={() => void saveTemplate()}
              >
                Сохранить форму
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
