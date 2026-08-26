"use client";

import { SafeLink as Link } from "@/app/safe-link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatInteger } from "@/lib/format-display";

const missionTypes = [
  { type: "LEAD", title: "Люди", icon: "↗", text: "Агент знакомит компанию с подходящим человеком и передаёт согласованный контакт." },
  { type: "DEAL", title: "Сделки", icon: "◇", text: "Вознаграждение после подтверждённой оплаты или договора." },
  { type: "IMAGE", title: "Имидж", icon: "◎", text: "Публикации, кейсы, отзывы и рекомендации с проверяемым результатом." },
  { type: "ENGAGEMENT", title: "Вовлечение", icon: "✦", text: "Обучающие, комьюнити- и игровые задания без агрессивных продаж." },
];

export function NewProgramForm({ companyName, tokenBalance, profileVersion, profileStatus }: { companyName: string; tokenBalance: number; profileVersion: number | null; profileStatus: string }) {
  const router = useRouter();
  const [name, setName] = useState(`Агентская программа ${companyName}`);
  const [goal, setGoal] = useState("MIXED");
  const [currency, setCurrency] = useState("KZT");
  const [selected, setSelected] = useState(["LEAD", "DEAL"]);
  const [pending, setPending] = useState<"ai" | "manual" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(type: string) {
    setSelected((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  async function generate(event: React.FormEvent, mode: "ai" | "manual" = "ai") {
    event.preventDefault();
    setPending(mode);
    setError(null);
    try {
      const response = await fetch("/api/programs/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, goal, currency, missionTypes: selected, mode }) });
      const data = await response.json() as { programId?: string; error?: string };
      if (!response.ok || !data.programId) throw new Error(data.error || "Не удалось сгенерировать программу");
      router.push(`/dashboard/programs/${data.programId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сгенерировать программу");
      setPending(null);
    }
  }

  return (
    <div className="dashboard-content module-content program-builder-page">
      <div className="builder-back"><Link href="/dashboard/programs">← Все программы</Link><span>{profileVersion ? `AI-профиль v${profileVersion}${profileStatus === "CONFIRMED" ? " · подтверждён" : " · черновик"}` : "AI-профиль не заполнен"} · {formatInteger(tokenBalance)} AI-кредитов</span></div>
      <div className="module-heading"><div><span className="module-kicker">НОВАЯ ПРОГРАММА · ШАГ 1 ИЗ 4</span><h1>Что вы хотите запустить?</h1><p>Выберите направление. На следующем экране вы настроите задания по одному — без длинной формы.</p></div></div>
      <div className="builder-stepper"><span className="active"><b>1</b>Основное</span><span><b>2</b>Задания</span><span><b>3</b>Условия</span><span><b>4</b>Проверка</span></div>

      <form className="program-create-layout" onSubmit={generate}>
        <section className="panel program-basics-card">
          <div className="panel-header"><div><h2>Основа программы</h2><p>Название увидят агенты по внешней ссылке.</p></div></div>
          <label className="builder-field"><span>Название программы</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
          <div className="builder-field-row"><label className="builder-field"><span>Главная цель</span><select value={goal} onChange={(event) => setGoal(event.target.value)}><option value="MIXED">Смешанная программа</option><option value="LEADS">Больше квалифицированных лидов</option><option value="DEALS">Больше оплаченных сделок</option><option value="BRAND">Узнаваемость и доверие</option><option value="ENGAGEMENT">Вовлечение агентов</option></select></label><label className="builder-field"><span>Валюта</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="KZT">KZT · ₸</option><option value="RUB">RUB · ₽</option><option value="USD">USD · $</option><option value="EUR">EUR · €</option></select></label></div>
        </section>

        <section className="panel mission-selector-card">
          <div className="panel-header"><div><h2>Выберите типы заданий</h2><p>От одного до четырёх. Для каждого типа будет создана отдельная карточка.</p></div><span>{selected.length} выбрано</span></div>
          <div className="mission-selector-grid">{missionTypes.map((mission) => { const active = selected.includes(mission.type); return <button type="button" className={`mission-select type-${mission.type.toLowerCase()} ${active ? "selected" : ""}`} onClick={() => toggle(mission.type)} key={mission.type} aria-pressed={active}><span className="mission-select-check">{active ? "✓" : "+"}</span><i>{mission.icon}</i><strong>{mission.title}</strong><small>{mission.text}</small></button>; })}</div>
        </section>

        {error && <div className="inline-notice error builder-error" role="alert">{error}</div>}
        <div className="builder-submit-bar"><div><strong>Выберите удобный старт</strong><p>Rela может заполнить задания за вас, либо вы начнёте с простых шаблонов и настроите всё вручную.</p></div><div className="new-program-actions"><button className="button button-ghost" type="button" onClick={(event) => void generate(event, "manual")} disabled={pending !== null || selected.length === 0}>{pending === "manual" ? "Создаём…" : "Настроить вручную"}</button><button className="button button-primary" type="submit" disabled={pending !== null || selected.length === 0}>{pending === "ai" ? "Rela создаёт задания…" : "Создать черновик с Rela"}<span>✦</span></button></div></div>
      </form>
    </div>
  );
}
