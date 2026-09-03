"use client";

import { localizeInterface } from "../../../lib/interface-locale";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProgramQuickActions({ id, initialStatus }: { id: string; initialStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");

  async function change(nextStatus: "ACTIVE" | "PAUSED" | "ARCHIVED") {
    if (nextStatus === "ARCHIVED" && !window.confirm(localizeInterface("Переместить программу в архив? Агентская ссылка перестанет открываться."))) return;
    setPending(nextStatus); setNotice("");
    const response = await fetch(`/api/programs/${id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
    const data = await response.json() as { error?: string; status?: string };
    if (response.ok && data.status) {
      setStatus(data.status);
      setNotice(nextStatus === "ACTIVE" ? "Запущена" : nextStatus === "PAUSED" ? "На паузе" : "В архиве");
      router.refresh();
    } else setNotice(data.error || "Не удалось изменить статус");
    setPending("");
  }

  return <div className="program-quick-actions" aria-label="Управление программой">
    {status === "ARCHIVED" ? <button className="program-restore-button" type="button" disabled={Boolean(pending)} onClick={() => void change("PAUSED")}>{pending ? "Возвращаем…" : "Вернуть на паузу"}</button> : status === "ACTIVE" ? <button type="button" title="Поставить на паузу" aria-label="Поставить программу на паузу" disabled={Boolean(pending)} onClick={() => void change("PAUSED")}>Ⅱ</button> : <button type="button" title="Возобновить" aria-label="Возобновить программу" disabled={Boolean(pending)} onClick={() => void change("ACTIVE")}>▶</button>}
    {status !== "ARCHIVED" && <button type="button" title="Переместить в архив" aria-label="Переместить программу в архив" disabled={Boolean(pending)} onClick={() => void change("ARCHIVED")}>⌑</button>}
    {notice && <small role="status">{notice}</small>}
  </div>;
}
