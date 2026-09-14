"use client";
import { useEffect, useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";

type Job = { submissionId: string; status: string; attempts: number };
export function EmailDeliveryStatus() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [canRetry, setCanRetry] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/api/company/notifications", { signal: abort.signal }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json() as { jobs: Job[]; canRetry: boolean };
      if (!abort.signal.aborted) { setJobs(data.jobs); setCanRetry(data.canRetry); setError(""); }
    }).catch(() => { if (!abort.signal.aborted) setError("Не удалось проверить доставку писем."); });
    return () => abort.abort();
  }, [refresh]);
  async function retry(job: Job) {
    setBusy(job.submissionId);
    try {
      const response = await fetch("/api/company/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId: job.submissionId }) });
      if (!response.ok) throw new Error();
      setRefresh((value) => value + 1);
    } catch { setError("Не удалось повторить отправку."); }
    finally { setBusy(""); }
  }
  if (!jobs.length && !error) return null;
  return <section className="dashboard-content module-content"><div className="panel"><h2>Доставка писем о заявках</h2><p>Заявки сохранены. Здесь последние 25 писем, которые ещё не отправлены.</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={() => setRefresh((value) => value + 1)}>Обновить</button>
    {jobs.map((job) => <article key={job.submissionId}><Link href={`/dashboard/crm?submission=${encodeURIComponent(job.submissionId)}`}>Открыть заявку</Link> · <span>{job.status === "FAILED" ? "Не удалось отправить" : "Ожидает отправки или повторной попытки"}</span>
      {canRetry && job.status === "FAILED" && <button type="button" disabled={Boolean(busy)} onClick={() => void retry(job)}>Повторить отправку</button>}
    </article>)}
  </div></section>;
}
