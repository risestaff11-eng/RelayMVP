"use client";

import { SafeLink as Link } from "@/app/safe-link";
import { useState } from "react";
import type { MissionRecord, ProgramRecord } from "../../../../db/programs";

const typeNames: Record<string, string> = { LEAD: "Лиды", DEAL: "Сделки", IMAGE: "Имидж", ENGAGEMENT: "Вовлечение" };

export function ProgramEditor({ initialProgram }: { initialProgram: ProgramRecord }) {
  const [program, setProgram] = useState(initialProgram);
  const [pending, setPending] = useState<"save" | "publish" | "pause" | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [publicUrl, setPublicUrl] = useState(program.status === "ACTIVE" ? `/p/${program.slug}` : null);

  function updateProgram(field: keyof ProgramRecord, value: string) {
    setProgram((current) => ({ ...current, [field]: value }));
  }

  function updateMission(id: string, field: keyof MissionRecord, value: string | number | string[]) {
    setProgram((current) => ({ ...current, missions: current.missions.map((mission) => mission.id === id ? { ...mission, [field]: value } : mission) }));
  }

  async function persist(action: "save" | "publish" | "pause") {
    setPending(action);
    setNotice(null);
    try {
      const response = await fetch(`/api/programs/${program.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...program, publish: action === "publish", pause: action === "pause", missions: program.missions }),
      });
      const data = await response.json() as { status?: string; publicUrl?: string | null; error?: string };
      if (!response.ok || !data.status) throw new Error(data.error || "Не удалось сохранить кампанию");
      setProgram((current) => ({ ...current, status: data.status! }));
      setPublicUrl(data.publicUrl ?? null);
      setNotice({ type: "success", text: action === "publish" ? "Кампания опубликована. Ссылка готова для агентов." : action === "pause" ? "Кампания поставлена на паузу." : "Черновик кампании сохранён." });
    } catch (reason) {
      setNotice({ type: "error", text: reason instanceof Error ? reason.message : "Не удалось сохранить кампанию" });
    } finally {
      setPending(null);
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(new URL(publicUrl, window.location.origin).href);
    setNotice({ type: "success", text: "Публичная ссылка скопирована." });
  }

  return (
    <div className="dashboard-content module-content program-builder-page">
      <div className="builder-back"><Link href="/dashboard/programs">← Все кампании</Link><span className={`program-status status-${program.status.toLowerCase()}`}>● {program.status === "ACTIVE" ? "Опубликована" : program.status === "PAUSED" ? "На паузе" : "Черновик"}</span></div>
      <div className="module-heading"><div><span className="module-kicker">НАСТРОЙКА ПРОГРАММЫ</span><h1>{program.name}</h1><p>Проверьте AI-черновики, зафиксируйте правила проверки и только затем публикуйте внешнюю ссылку.</p></div>{publicUrl && <div className="published-link-actions"><Link className="button button-ghost compact-button" href={publicUrl} target="_blank">Открыть страницу ↗</Link><button className="button button-primary compact-button" type="button" onClick={copyLink}>Копировать ссылку</button></div>}</div>
      <div className="builder-stepper"><span className="done"><b>✓</b>Основа</span><span className="active"><b>2</b>Задания и награды</span><span className={program.status === "ACTIVE" ? "done" : ""}><b>{program.status === "ACTIVE" ? "✓" : "3"}</b>Правила и публикация</span></div>
      {notice && <div className={`inline-notice ${notice.type}`} role="status">{notice.text}</div>}

      <section className="panel program-general-card">
        <div className="panel-header"><div><h2>Описание кампании</h2><p>Коротко объясните агенту, что он может рекомендовать и какой результат ожидается.</p></div></div>
        <label className="builder-field"><span>Название</span><input value={program.name} onChange={(event) => updateProgram("name", event.target.value)} /></label>
        <label className="builder-field"><span>Описание</span><textarea rows={4} value={program.description} onChange={(event) => updateProgram("description", event.target.value)} /></label>
        <div className="builder-field-row"><label className="builder-field"><span>Цель</span><select value={program.goal} onChange={(event) => updateProgram("goal", event.target.value)}><option value="MIXED">Смешанная</option><option value="LEADS">Лиды</option><option value="DEALS">Сделки</option><option value="BRAND">Имидж</option><option value="ENGAGEMENT">Вовлечение</option></select></label><label className="builder-field"><span>Валюта</span><select value={program.currency} onChange={(event) => updateProgram("currency", event.target.value)}><option>KZT</option><option>RUB</option><option>USD</option><option>EUR</option></select></label></div>
      </section>

      <div className="mission-editor-heading"><div><span className="module-kicker">ШАГ 2</span><h2>Задания и награды</h2><p>Награда различается по типу результата. AI предложил стартовые значения — ответственность за финальные условия остаётся у компании.</p></div><span>{program.missions.length} карточки</span></div>
      <section className="mission-editor-grid">{program.missions.map((mission, index) => <article className={`panel mission-editor-card type-${mission.type.toLowerCase()}`} key={mission.id}><div className="mission-editor-top"><span>0{index + 1} · {typeNames[mission.type]}</span><i>{mission.type === "LEAD" ? "↗" : mission.type === "DEAL" ? "◇" : mission.type === "IMAGE" ? "◎" : "✦"}</i></div><label className="builder-field"><span>Название задания</span><input value={mission.title} onChange={(event) => updateMission(mission.id, "title", event.target.value)} /></label><label className="builder-field"><span>Что нужно получить</span><textarea rows={3} value={mission.description} onChange={(event) => updateMission(mission.id, "description", event.target.value)} /></label><label className="builder-field"><span>Шаги агента · по одному в строке</span><textarea rows={5} value={mission.instructions.join("\n")} onChange={(event) => updateMission(mission.id, "instructions", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} /></label><label className="builder-field"><span>Что приложить для проверки</span><textarea rows={3} value={mission.proofRequirements.join("\n")} onChange={(event) => updateMission(mission.id, "proofRequirements", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} /></label><div className="reward-editor"><label className="builder-field"><span>Тип награды</span><select value={mission.rewardMode} onChange={(event) => updateMission(mission.id, "rewardMode", event.target.value)}><option value="FIXED">Фиксированная сумма</option><option value="PERCENT">Процент</option><option value="POINTS">Баллы</option><option value="NON_MONETARY">Неденежная</option></select></label><label className="builder-field"><span>Значение</span><input type="number" min="0" value={mission.rewardValue} onChange={(event) => updateMission(mission.id, "rewardValue", Number(event.target.value))} /></label></div><label className="builder-field"><span>Как увидит агент</span><input value={mission.rewardLabel} onChange={(event) => updateMission(mission.id, "rewardLabel", event.target.value)} placeholder={`Например: 25 000 ${program.currency}`} /></label><label className="builder-field"><span>Правила проверки</span><textarea rows={3} value={mission.verificationRules} onChange={(event) => updateMission(mission.id, "verificationRules", event.target.value)} /></label></article>)}</section>

      <section className="panel publication-card">
        <div className="panel-header"><div><span className="module-kicker">ШАГ 3</span><h2>Выплата, ограничения и публикация</h2><p>Эти условия видит агент до выполнения задания. Не оставляйте их двусмысленными.</p></div></div>
        <div className="publication-grid"><label className="builder-field"><span>Когда и как выплачивается награда</span><textarea rows={5} value={program.payoutTerms} onChange={(event) => updateProgram("payoutTerms", event.target.value)} placeholder="Например: в течение 10 рабочих дней после оплаты сделки клиентом." /></label><label className="builder-field"><span>Юридические и этические ограничения</span><textarea rows={5} value={program.legalTerms} onChange={(event) => updateProgram("legalTerms", event.target.value)} placeholder="Запрет спама, самостоятельных обещаний цены и представления сотрудником компании." /></label></div><label className="builder-field publication-date"><span>Дата завершения · необязательно</span><input type="date" value={program.expiresAt?.slice(0, 10) ?? ""} onChange={(event) => updateProgram("expiresAt", event.target.value)} /></label>
      </section>

      <div className="program-publish-bar"><div><strong>{program.status === "ACTIVE" ? "Кампания уже доступна агентам" : "Публикация создаст внешнюю ссылку"}</strong><p>После публикации задания можно редактировать, но существенные изменения лучше сообщать действующим агентам отдельно.</p></div><div><button className="button button-ghost" type="button" onClick={() => persist("save")} disabled={pending !== null}>{pending === "save" ? "Сохраняем…" : "Сохранить черновик"}</button>{program.status === "ACTIVE" ? <button className="button button-ghost" type="button" onClick={() => persist("pause")} disabled={pending !== null}>{pending === "pause" ? "Ставим на паузу…" : "Поставить на паузу"}</button> : <button className="button button-primary" type="button" onClick={() => persist("publish")} disabled={pending !== null}>{pending === "publish" ? "Публикуем…" : "Опубликовать кампанию"}<span>→</span></button>}</div></div>
    </div>
  );
}
