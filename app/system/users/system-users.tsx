"use client";

import { useState } from "react";

type Row = { id: string; name: string; email: string; phone: string; company: string; createdAt: string; status: string };

export function SystemUsers({ authorized, initialRows }: { authorized: boolean; initialRows: Row[] }) {
  const [ready] = useState(authorized);
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const response = await fetch("/api/system/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setError(data.error || "Доступ запрещён");
    window.location.reload();
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
  return <main className="system-users"><h1>Пользователи</h1>{error && <p className="system-error">{error}</p>}<div className="system-table"><div className="system-row system-head"><span>Имя</span><span>Email</span><span>Телефон</span><span>Компания</span><span>Дата регистрации</span><span>Статус</span><span>Действия</span></div>{rows.map((row) => <div className="system-row" key={row.id}><span>{row.name}</span><span>{row.email}</span><span>{row.phone || "—"}</span><span>{row.company || "—"}</span><span>{new Date(row.createdAt).toLocaleString("ru-RU")}</span><span>{row.status}</span><span className="system-actions"><button disabled={busy === row.id} onClick={() => update(row.id, "active")}>Активировать</button><button disabled={busy === row.id} onClick={() => update(row.id, "blocked")}>Заблокировать</button><button disabled={busy === row.id} onClick={() => remove(row.id)}>Удалить</button></span></div>)}</div>{rows.length === 0 && <p>Заявок пока нет.</p>}</main>;
}
