"use client";
import { useState } from "react";
export function Clarification({ submissionId, token, reminder = false }: {
    submissionId: string;
    token?: string;
    reminder?: boolean;
}) {
    const [pending, setPending] = useState(false);
    const [notice, setNotice] = useState("");
    async function send(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); if (pending)
        return; const form = new FormData(event.currentTarget); setPending(true); setNotice(""); try {
        form.set("submissionId", submissionId);
        if (token)
            form.set("token", token);
        form.set("action", reminder ? "REMIND" : "NOTE");
        const r = await fetch(token ? "/api/partner/notes" : "/api/company/agent-clarification", token ? { method: "POST", body: form } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId, comment: form.get("comment") }) });
        const data = await r.json() as {
            error?: string;
        };
        if (!r.ok)
            throw Error(data.error || "Не удалось отправить");
        window.location.reload();
    }
    catch (error) {
        setNotice(error instanceof Error ? error.message : "Не удалось отправить");
        setPending(false);
    } }
    return <details className="agent-clarification"><summary>{reminder ? "Напомнить компании" : token ? "Добавить уточнение" : "Запросить уточнение у агента"}</summary><form onSubmit={send}>{!reminder && <><label><span>{token ? "Дополнение к заявке" : "Что нужно уточнить"}</span><textarea name="comment" required minLength={3} maxLength={2400} rows={3}/></label>{token && <label><span>Файл · до 10 МБ</span><input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"/></label>}</>}{reminder && <p>Напоминание сохранится в истории заявки. Повторное доступно через 24 часа.</p>}<button type="submit" disabled={pending}>{pending ? "Отправляем…" : "Отправить"}</button><p role="status">{notice}</p></form></details>;
}
