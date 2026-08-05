"use client";

import { useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";

export function PublicMissionAction({ token, missionId, programSlug, accepted }: { token: string; missionId: string; programSlug: string; accepted: boolean }) {
  const [state, setState] = useState<"idle" | "pending" | "accepted">(accepted ? "accepted" : "idle");
  const [error, setError] = useState("");
  async function accept() {
    setState("pending"); setError("");
    const response = await fetch("/api/partner/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, action: "ACCEPT_MISSION", missionId }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setState("idle"); setError(data.error || "Не удалось взять миссию"); return; }
    setState("accepted");
  }
  return <div className="public-mission-action">{state === "accepted" ? <Link className="partner-mission-cta" href={`/p/${programSlug}/missions/${missionId}/submit?access=${token}`}>Передать результат <span>→</span></Link> : <button className="partner-mission-cta" type="button" disabled={state === "pending"} onClick={accept}>{state === "pending" ? "Добавляем миссию…" : "Взять миссию"}<span>＋</span></button>}<small aria-live="polite">{error}</small></div>;
}
