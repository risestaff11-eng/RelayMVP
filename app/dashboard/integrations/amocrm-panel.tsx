"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { IntegrationOverview } from "@/lib/integrations/service";
import type { AmoPipeline } from "@/lib/integrations/amocrm-client";

type Account = { accountName: string; currency: string; pipelines: AmoPipeline[] };
export function AmoCrmPanel({ connections }: { connections: IntegrationOverview["connections"] }) {
  const router = useRouter();
  const connection = connections.find(c => c.provider === "AMOCRM");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [pipelineId, setPipelineId] = useState(0);
  const [initialId, setInitialId] = useState(0);
  const [paidId, setPaidId] = useState(0);
  const [currency, setCurrency] = useState("KZT");
  const [confirmed, setConfirmed] = useState(false);
  const [stages, setStages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const pipeline = account?.pipelines.find(p => p.id === pipelineId);
  async function request<T = Record<string, unknown>>(path: string, method: string, body: Record<string, unknown>): Promise<T | null> {
    if (busy) return null;
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json() as T & { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось выполнить действие");
      return data;
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Не удалось выполнить действие"); return null; }
    finally { setBusy(false); }
  }
  function selectPipeline(id: number, next = account) {
    setPipelineId(id); setPaidId(0); setConfirmed(false); setStages({});
    setInitialId(next?.pipelines.find(p => p.id === id)?._embedded.statuses.find(s => ![142, 143].includes(s.id))?.id || 0);
  }
  async function inspect(event: FormEvent) {
    event.preventDefault();
    const data = await request<Account>("/api/company/integrations/amocrm", "POST", { action: "inspect", url, token });
    if (data) { setAccount(data); selectPipeline(data.pipelines[0].id, data); if (data.currency) setCurrency(data.currency); }
  }
  async function connect(event: FormEvent) {
    event.preventDefault();
    const data = await request("/api/company/integrations/amocrm", "POST", { url, token, pipelineId, initialStatusId: initialId, paidStatusId: paidId || null, currency, stageMap: stages, confirmFullPayment: confirmed });
    if (data) { setToken(""); setAccount(null); setMessage("Подключение сохранено на паузе. Включите передачу, когда будете готовы."); router.refresh(); }
  }
  async function change(body: Record<string, unknown>) {
    const data = await request(`/api/company/integrations/amocrm/${connection!.id}`, "PATCH", body);
    if (data) { if (body.token) setToken(""); router.refresh(); }
  }
  async function sync() {
    const data = await request<{ checked: number; updated: number; errors: string[] }>(`/api/company/integrations/amocrm/${connection!.id}`, "POST", {});
    if (data) {
      setFailed(!!data.errors?.length);
      setMessage(data.errors?.length ? data.errors.join(" · ") : `Проверено: ${data.checked}. Обновлено: ${data.updated}.`);
      router.refresh();
    }
  }
  return <section className="integration-panel amo-panel" aria-labelledby="amocrm-title">
    <header><div><h2 id="amocrm-title">amoCRM</h2><p>Передайте клиента в свою воронку и верните этап сделки в кабинет агента.</p></div><span className={`integration-status ${connection?.status === "ACTIVE" ? "active" : "paused"}`}>{connection ? connection.status === "ACTIVE" ? "Работает" : "На паузе" : "Не подключена"}</span></header>
    {message && <p className={`integration-alert ${failed ? "error" : ""}`} role={failed ? "alert" : "status"}>{message}</p>}
    {connection ? <div className="amo-connected"><a href={connection.config.url} target="_blank" rel="noreferrer" data-no-translate>{connection.config.url}</a><p>Новые рекомендации передаются автоматически. Существующие заявки до подключения не выгружаются.</p><p>Возвращаются только сопоставленные этапы. Вознаграждение рассчитывается по правилам задания; перевод денег остаётся отдельным действием.</p>{connection.lastError && <p role="alert">{connection.lastError}</p>}<div className="integration-actions"><button type="button" disabled={busy} onClick={() => void change({ status: connection.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })}>{connection.status === "ACTIVE" ? "Поставить на паузу" : "Включить передачу"}</button><button type="button" disabled={busy || connection.status !== "ACTIVE"} onClick={() => void sync()}>Синхронизировать сейчас</button></div><details><summary>Обновить доступ</summary><form className="integration-form" onSubmit={e => { e.preventDefault(); void change({ token }); }}><label>Новый токен доступа<input type="password" value={token} onChange={e => setToken(e.target.value)} required autoComplete="off" /></label><button type="submit" className="integration-primary" disabled={busy}>Сохранить доступ</button></form></details></div>
      : <><ol className="amo-steps"><li>Администратор amoCRM предоставляет доступ к аккаунту.</li><li>Вы выбираете воронку и соответствие этапов.</li><li>Включаете передачу новых рекомендаций.</li></ol><p>Для первой настройки нужен администратор amoCRM или ваш интегратор. Проверка доступа читает настройки и не создаёт тестовых клиентов.</p><form className="integration-form" onSubmit={inspect}><label>Адрес аккаунта amoCRM<input type="url" placeholder="https://company.amocrm.ru" value={url} onChange={e => { setUrl(e.target.value); setAccount(null); }} required /></label><label>Токен доступа<input type="password" value={token} onChange={e => { setToken(e.target.value); setAccount(null); }} autoComplete="off" required /></label><button className="integration-primary" disabled={busy} type="submit">Проверить доступ и загрузить воронки</button></form>
      {account && <form className="integration-form amo-mapping" onSubmit={connect}><strong data-no-translate>{account.accountName}</strong><label>Воронка<select value={pipelineId} onChange={e => selectPipeline(Number(e.target.value))}>{account.pipelines.map(p => <option key={p.id} value={p.id} data-no-translate>{p.name}</option>)}</select></label><label>Куда поступает новый клиент<select value={initialId} onChange={e => setInitialId(Number(e.target.value))}>{pipeline?._embedded.statuses.filter(s => ![142,143].includes(s.id)).map(s => <option key={s.id} value={s.id} data-no-translate>{s.name}</option>)}</select></label><label>Валюта аккаунта<input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} required readOnly={!!account.currency} /></label><fieldset><legend>Как вернуть этапы в RiseStaff</legend>{pipeline?._embedded.statuses.map(s => <label className="amo-stage-row" key={s.id}><span data-no-translate>{s.name}</span><select value={stages[s.id] || ""} onChange={e => setStages(current => { const next = { ...current }; if (e.target.value) next[s.id] = e.target.value; else delete next[s.id]; return next; })}><option value="">Не менять этап RiseStaff</option><option value="REVIEWING">Проверка</option><option value="IN_PROGRESS">В работе</option><option value="AGREEMENT">Договор / предоплата</option><option value="LOST">Сделка не состоялась</option></select></label>)}</fieldset><label>Этап полной оплаты<select value={paidId} onChange={e => { setPaidId(Number(e.target.value)); setConfirmed(false); }}><option value={0}>Подтверждать оплату вручную в RiseStaff</option>{pipeline?._embedded.statuses.filter(s => s.id !== 143 && s.id !== initialId).map(s => <option key={s.id} value={s.id} data-no-translate>{s.name}</option>)}</select></label>{paidId > 0 && <label className="amo-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />Этот этап означает полную оплату клиентом. Можно начислить вознаграждение по условиям задания.</label>}<p>При сохранении в amoCRM появятся два поля: идентификатор заявки и её источник. Токен хранится зашифрованным. Подключение сначала будет на паузе.</p><button className="integration-primary" type="submit" disabled={busy || (!!paidId && !confirmed)}>Сохранить подключение</button></form>}</>}
  </section>;
}
