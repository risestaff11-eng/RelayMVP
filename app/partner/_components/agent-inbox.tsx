"use client";
import { useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";
export function AgentInbox({ token, events, readAt, children }: {
    children?: React.ReactNode;
    token: string;
    events: Array<{
        id: string;
        submissionId: string;
        name: string;
        comment: string;
        createdAt: string;
    }>;
    readAt: string | null;
}) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const unread = events.filter(e => !readAt || e.createdAt > readAt);
    async function read() { setPending(true); try {
        const r = await fetch("/api/partner/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, action: "READ_EVENTS", through: events[0]?.createdAt }) });
        if (!r.ok)
            throw Error();
        window.location.reload();
    }
    catch {
        setError("Не удалось отметить уведомления");
        setPending(false);
    } }
    return <details className="agent-inbox"><summary>Уведомления{unread.length > 0 && <b>{unread.length}</b>}</summary><div className="agent-inbox-content">{events.length ? events.slice(0, 30).map(e => <Link key={e.id} href={`/partner/${token}/submissions/${e.submissionId}`}><strong data-no-translate>{e.name}</strong><span data-no-translate>{e.comment || "Статус заявки обновлён"}</span>{(!readAt || e.createdAt > readAt) && <small>Новое</small>}</Link>) : <p>Новых уведомлений пока нет.</p>}{unread.length > 0 && <button type="button" disabled={pending} onClick={() => void read()}>Отметить прочитанными</button>}<p role="status">{error}</p>{children}</div></details>;
}
