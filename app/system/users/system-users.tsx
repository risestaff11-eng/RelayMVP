"use client";

import { useState } from "react";
import { formatDateTime, formatInteger } from "@/lib/format-display";

type Row = { id: string; name: string; email: string; phone: string; company: string; createdAt: string; status: string; tokenBalance: number | null };

export function SystemUsers({ authorized, initialRows }: { authorized: boolean; initialRows: Row[] }) {
  const [ready] = useState(authorized);
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [tokenAmounts, setTokenAmounts] = useState<Record<string, string>>({});

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const response = await fetch("/api/system/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setError(data.error || "Доступ запрещён");
    window.location.reload();
  }

  async function addTokens(id: string) {
    const tokenAmount = Math.round(Number(tokenAmounts[id]));
    if (!tokenAmount || tokenAmount < 1) return setError("Введите количество AI-кредитов больше нуля");
    setBusy(id); setError("");
    const response = await fetch(`/api/system/users/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ tokenAmount }) });
    const data = await response.json() as { error?: string; tokenBalance?: number };
    if (response.ok && typeof data.tokenBalance === "number") {
      setRows((current) => current.map((row) => row.id === id ? { ...row, tokenBalance: data.tokenBalance! } : row));
      setTokenAmounts((current) => ({ ...current, [id]: "" }));
    } else setError(data.error || "Не удалось начислить AI-кредиты");
    setBusy("");
  }

  async function update(id: string, status: string) {
    setBusy(id); setError("");
    const response = await fetch(`/api/system/users/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row));
    else setError("Не удалось изменить статус");
    setBusy("");
  }

  async function remove(id: string) {
    if (!window.confirm("Удалить пользователя и связанные данные компании?")) return;
    setBusy(id); setError("");
    const response = await fetch(`/api/system/users/${id}`, { method: "DELETE" });
    if (response.ok) setRows((current) => current.filter((row) => row.id !== id));
    else setError("Не удалось удалить пользователя");
    setBusy("");
  }

  if (!ready) return <main className="system-gate"><form onSubmit={login}><label>Пароль<input name="password" type="password" required /></label>{error && <p>{error}</p>}<button type="submit">Открыть</button></form></main>;
  return <main className="system-users"><h1>Пользователи</h1>{error && <p className="system-error">{error}</p>}<div className="system-table"><div className="system-row system-head"><span>Имя</span><span>Email</span><span>Телефон</span><span>Компания</span><span>Дата регистрации</span><span>Статус</span><span>AI-кредиты</span><span>Действия</span></div>{rows.map((row) => <div className="system-row" key={row.id}><span data-label="Имя">{row.name}</span><span data-label="Email">{row.email}</span><span data-label="Телефон">{row.phone || "—"}</span><span data-label="Компания">{row.company || "—"}</span><span data-label="Дата регистрации">{formatDateTime(row.createdAt)}</span><span data-label="Статус">{row.status}</span><span className="system-token-cell" data-label="AI-кредиты"><b>{formatInteger(row.tokenBalance ?? 0)}</b><label><input type="number" min="1" max="10000000" placeholder="Добавить" value={tokenAmounts[row.id] ?? ""} onChange={(event) => setTokenAmounts((current) => ({ ...current, [row.id]: event.target.value }))} /><button disabled={busy === row.id} onClick={() => void addTokens(row.id)}>+</button></label></span><span className="system-actions" data-label="Действия"><button disabled={busy === row.id} onClick={() => update(row.id, "active")}>Активировать</button><button disabled={busy === row.id} onClick={() => update(row.id, "blocked")}>Заблокировать</button><button disabled={busy === row.id} onClick={() => remove(row.id)}>Удалить</button></span></div>)}</div>{rows.length === 0 && <p>Заявок пока нет.</p>}</main>;
}
