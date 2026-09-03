"use client";
import { reportMetricEntries, reportMetricValue } from "../../../../lib/reporting";
/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/media-has-caption */
import { useMemo, useRef, useState } from "react";
import type { ReportField } from "../../../../lib/reporting";
import { countRu } from "@/lib/format-display";
type FileRow = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: string;
};
type Report = {
  id: string;
  programId: string | null;
  periodStart: string;
  periodEnd: string;
  status: string;
  answers: Record<string, unknown>;
  metrics: Record<string, number>;
  transcript: string;
  companyComment: string;
  templateSnapshot: ReportField[];
  files: FileRow[];
  updatedAt: string;
};
const statuses: Record<string, string> = {
  DRAFT: "Черновик",
  SUBMITTED: "Отправлен",
  VIEWED: "Просмотрен",
  NEEDS_CLARIFICATION: "Требует уточнения",
  ACCEPTED: "Принят",
};
const metricNames: Record<string, string> = {
  completedTasks: "Выполнено заданий",
  submissions: "Передано заявок",
  accepted: "Подтверждено",
  rejected: "Отклонено",
  leads: "Лиды",
  deals: "Сделки",
  accrued: "Начислено",
  paid: "Компания отметила перевод",
  confirmed: "Получение подтверждено",
  confirmedRewardsCount: "Получений подтверждено",
  paidRewardsCount: "Переводов за период",
  pendingRewardsCount: "Выплат ожидается",
  pending: "Ожидает выплаты",
};
const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return date.toISOString().slice(0, 10);
};

export function ReportCenter({
  token,
  companyName,
  programs,
  template,
  initialReports,
}: {
  token: string;
  companyName: string;
  programs: Array<{ id: string; name: string }>;
  template: { fields: ReportField[]; metrics: string[] };
  initialReports: Report[];
}) {
  const [reports, setReports] = useState(initialReports);
  const [editing, setEditing] = useState<Report | null>(null);
  const [creating, setCreating] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [periodStart, setPeriodStart] = useState(weekAgo());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [programId, setProgramId] = useState(programs[0]?.id || "");
  const [files, setFiles] = useState<File[]>([]);
  const [audio, setAudio] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [duration, setDuration] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState<{
    fieldId: string;
    seconds: number;
  } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fields = (editing?.templateSnapshot || template.fields).filter(
    (field) => field.enabled,
  );
  const metricEntries = useMemo(
    () => reportMetricEntries(editing?.metrics || {}),
    [editing],
  );
  function open(report?: Report) {
    setEditing(report || null);
    setCreating(true);
    setAnswers(report?.answers || {});
    setPeriodStart(report?.periodStart || weekAgo());
    setPeriodEnd(report?.periodEnd || today());
    setProgramId(report?.programId || programs[0]?.id || "");
    setTranscript(report?.transcript || "");
    setFiles([]);
    setAudio(null);
    setAudioUrl("");
    setError("");
  }
  function close() {
    setCreating(false);
    setEditing(null);
  }
  async function transcribe(file: File, seconds: number, fieldId = "") {
    setPending(true);
    setError("");
    try {
      const form = new FormData();
      form.set("token", token);
      form.set("audio", file);
      form.set("durationSeconds", String(seconds));
      if (fieldId) form.set("fieldId", fieldId);
      const response = await fetch("/api/partner/reports/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as {
        transcript?: string;
        answers?: Array<{ fieldId: string; value: string }>;
        unassigned?: string;
        durationSeconds?: number;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Не удалось расшифровать");
      setTranscript((value) =>
        fieldId ? value : [value, data.transcript].filter(Boolean).join("\n"),
      );
      const recognizedAnswers = Object.fromEntries(
        (data.answers || []).map((item) => [item.fieldId, item.value]),
      );
      if (fieldId && !String(recognizedAnswers[fieldId] || "").trim()) {
        recognizedAnswers[fieldId] = String(
          data.transcript || data.unassigned || "",
        ).trim();
      }
      if (fieldId && !String(recognizedAnswers[fieldId] || "").trim()) {
        throw new Error(
          "Не удалось распознать ответ. Запишите его ещё раз или введите вручную.",
        );
      }
      setAnswers((current) => ({ ...current, ...recognizedAnswers }));
      if (!fieldId) {
        setAudio(file);
        setAudioUrl(URL.createObjectURL(file));
        setDuration(data.durationSeconds || seconds);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка расшифровки");
    } finally {
      setPending(false);
    }
  }
  async function start(fieldId = "") {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      recorder.current = media;
      chunks.current = [];
      let seconds = 0;
      setRecording({ fieldId, seconds });
      media.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const file = new File(
          chunks.current,
          fieldId ? "field-answer.webm" : "report.webm",
          { type: media.mimeType || "audio/webm" },
        );
        void transcribe(file, seconds, fieldId);
      };
      media.start();
      timer.current = setInterval(() => {
        seconds++;
        setRecording({ fieldId, seconds });
        if (seconds >= (fieldId ? 60 : 180)) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          if (media.state === "recording") media.stop();
        }
      }, 1000);
    } catch {
      setError("Разрешите доступ к микрофону или заполните поле вручную");
    }
  }
  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(null);
  }
  async function save(submit: boolean) {
    setPending(true);
    setError("");
    try {
      const form = new FormData();
      form.set("token", token);
      if (editing) form.set("reportId", editing.id);
      form.set("programId", programId);
      form.set("periodStart", periodStart);
      form.set("periodEnd", periodEnd);
      form.set("answers", JSON.stringify(answers));
      form.set("transcript", transcript);
      form.set("audioDurationSeconds", String(duration));
      form.set("submit", submit ? "yes" : "no");
      files.forEach((file) => form.append("files", file));
      if (audio) form.set("audio", audio);
      const response = await fetch("/api/partner/reports", {
        method: "POST",
        body: form,
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить");
      const refreshed = (await fetch(
        `/api/partner/reports?token=${token}`,
      ).then((item) => item.json())) as { reports: Report[] };
      setReports(refreshed.reports);
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Ошибка сохранения");
    } finally {
      setPending(false);
    }
  }
  async function removeExisting(fileId: string) {
    if (!editing) return;
    const response = await fetch(
      `/api/partner/reports?token=${token}&fileId=${fileId}`,
      { method: "DELETE" },
    );
    if (response.ok)
      setEditing({
        ...editing,
        files: editing.files.filter((file) => file.id !== fileId),
      });
  }
  function fieldControl(field: ReportField) {
    const value = answers[field.id] ?? "";
    const common = {
      value: String(value),
      onChange: (
        event: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) => setAnswers({ ...answers, [field.id]: event.target.value }),
    };
    if (field.type === "TEXTAREA") return <textarea rows={4} {...common} />;
    if (field.type === "SELECT")
      return (
        <select {...common}>
          <option value="">Выберите</option>
          {field.options.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      );
    if (field.type === "BOOLEAN")
      return (
        <select {...common}>
          <option value="">Выберите</option>
          <option>Да</option>
          <option>Нет</option>
        </select>
      );
    if (field.type === "MULTISELECT")
      return <input {...common} placeholder="Введите варианты через запятую" />;
    return (
      <input
        type={
          field.type === "NUMBER"
            ? "number"
            : field.type === "DATE"
              ? "date"
              : field.type === "URL"
                ? "url"
                : "text"
        }
        {...common}
      />
    );
  }
  return (
    <div className="partner-portal-content report-center">
      <div className="partner-page-heading">
        <div>
          <span>РАБОЧАЯ ИСТОРИЯ</span>
          <h1>Отчёты</h1>
          <p>
            Надиктуйте отчёт за 1–3 минуты или заполните только нужные поля.
          </p>
        </div>
        <button className="button button-primary" onClick={() => open()}>
          ＋ Создать отчёт
        </button>
      </div>
      {!reports.length && (
        <section className="report-empty">
          <b>Первый отчёт займёт несколько минут</b>
          <p>
            RiseStaff разложит голосовой ответ по полям, а показатели из заявок и
            выплат добавятся автоматически.
          </p>
          <button onClick={() => open()}>Создать отчёт →</button>
        </section>
      )}
      <div className="report-history">
        {reports.map((report) => (
          <article
            key={report.id}
            onClick={() =>
              ["DRAFT", "NEEDS_CLARIFICATION"].includes(report.status) &&
              open(report)
            }
          >
            <header>
              <span className={`report-status ${report.status.toLowerCase()}`}>
                {statuses[report.status]}
              </span>
              <time>
                {report.periodStart} — {report.periodEnd}
              </time>
            </header>
            <h3>
              {(programs.find((item) => item.id === report.programId)?.name) ? (programs.find((item) => item.id === report.programId)?.name) : (<bdi data-no-translate>{companyName}</bdi>)}
            </h3>
            <p>
              {String(
                report.answers.main_results ||
                  report.answers.work_done ||
                  report.transcript ||
                  "Черновик без текста",
              ).slice(0, 180)}
            </p>
            <footer>
              <span>{countRu(report.files.length, "файл", "файла", "файлов")}</span>
              <span>
                {Object.values(report.metrics).filter(Boolean).length}{" "}
                показателей
              </span>
              {["DRAFT", "NEEDS_CLARIFICATION"].includes(report.status) && (
                <b>Продолжить →</b>
              )}
            </footer>
            {report.companyComment && (
              <aside>
                <b>Комментарий компании</b>
                {<bdi data-no-translate>{report.companyComment}</bdi>}
              </aside>
            )}
          </article>
        ))}
      </div>
      {creating && (
        <div className="report-sheet-backdrop">
          <section className="report-sheet" role="dialog" aria-modal="true">
            <header>
              <div>
                <small>
                  {editing ? statuses[editing.status] : "НОВЫЙ ОТЧЁТ"}
                </small>
                <h2>{editing ? "Продолжить отчёт" : "Отчёт без бюрократии"}</h2>
              </div>
              <button onClick={close} aria-label="Закрыть">
                ×
              </button>
            </header>
            <div className="report-period">
              <label>
                С
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </label>
              <label>
                По
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </label>
              <label>
                Программа
                <select
                  value={programId}
                  onChange={(e) => setProgramId(e.target.value)}
                >
                  {programs.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <section className="report-voice-hero">
              <div>
                <b>Заполнить весь отчёт голосом</b>
                <p>До 3 минут. RiseStaff заполнит поля, вы проверите каждое.</p>
              </div>
              {recording && !recording.fieldId ? (
                <button className="recording" onClick={stop}>
                  ■ Остановить · {recording.seconds} сек.
                </button>
              ) : (
                <button
                  disabled={pending || Boolean(recording)}
                  onClick={() => void start()}
                >
                  ● Записать отчёт
                </button>
              )}
              <label>
                Загрузить аудио
                <input
                  type="file"
                  hidden
                  accept="audio/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void transcribe(file, 0);
                  }}
                />
              </label>
              {audioUrl && <audio controls src={audioUrl} />}
            </section>
            {metricEntries.length > 0 && (
              <section className="report-auto-metrics">
                <h3>Показатели за период</h3>
                <div>
                  {metricEntries.map(([key, value]) => (
                    <span key={key}>
                      <small>{metricNames[key.split(":")[0]] || key}</small>
                      <strong>
                        {reportMetricValue(key, value)}
                      </strong>
                    </span>
                  ))}
                </div>
              </section>
            )}
            <div className="report-fields">
              {fields
                .filter((field) => field.type !== "FILE")
                .map((field) => (
                  <label key={field.id}>
                    <span>
                      {field.label}
                      {field.required && <b>*</b>}
                    </span>
                    <small>{field.description}</small>
                    {fieldControl(field)}
                    {["TEXT", "TEXTAREA"].includes(field.type) &&
                      (recording?.fieldId === field.id ? (
                        <button
                          type="button"
                          className="field-mic recording"
                          onClick={stop}
                        >
                          ■ {recording.seconds} сек.
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="field-mic"
                          disabled={pending || Boolean(recording)}
                          onClick={() => void start(field.id)}
                        >
                          ● Ответить голосом
                        </button>
                      ))}
                  </label>
                ))}
            </div>
            <section className="report-files">
              <h3>
                Файлы <small>до 5 файлов, каждый до 10 МБ</small>
              </h3>
              {editing?.files
                .filter((file) => file.kind === "ATTACHMENT")
                .map((file) => (
                  <div key={file.id}>
                    <span>
                      {<bdi data-no-translate>{file.fileName}</bdi>} · {Math.ceil(file.size / 1024)} КБ
                    </span>
                    <button onClick={() => void removeExisting(file.id)}>
                      Удалить
                    </button>
                  </div>
                ))}
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`}>
                  <span>
                    {file.name} · {Math.ceil(file.size / 1024)} КБ
                  </span>
                  <button
                    onClick={() =>
                      setFiles(files.filter((_, i) => i !== index))
                    }
                  >
                    Удалить
                  </button>
                </div>
              ))}
              <label className="report-file-add">
                ＋ Добавить файлы
                <input
                  hidden
                  multiple
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.csv,image/*"
                  onChange={(e) =>
                    setFiles(
                      [...files, ...Array.from(e.target.files || [])].slice(
                        0,
                        5 -
                          (editing?.files.filter(
                            (file) => file.kind === "ATTACHMENT",
                          ).length || 0),
                      ),
                    )
                  }
                />
              </label>
            </section>
            {transcript && (
              <details>
                <summary>Расшифровка оригинала</summary>
                <textarea
                  rows={6}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
              </details>
            )}
            {error && <div className="inline-notice error">{error}</div>}
            <footer>
              <button disabled={pending} onClick={() => void save(false)}>
                Сохранить черновик
              </button>
              <button
                className="button button-primary"
                disabled={pending}
                onClick={() => void save(true)}
              >
                {pending ? "Сохраняем…" : "Проверил и отправить →"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
