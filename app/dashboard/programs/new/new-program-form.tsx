"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const missionTypes = [
  { type: "LEAD", title: "Лиды", icon: "↗", text: "Партнёр передаёт контакт, который соответствует критериям." },
  { type: "DEAL", title: "Сделки", icon: "◇", text: "Вознаграждение после подтверждённой оплаты или договора." },
  { type: "IMAGE", title: "Имидж", icon: "◎", text: "Публикации, кейсы, отзывы и рекомендации с проверяемым результатом." },
  { type: "ENGAGEMENT", title: "Вовлечение", icon: "✦", text: "Обучающие, комьюнити- и игровые задания без агрессивных продаж." },
];

export function NewProgramForm({ companyName, tokenBalance, profileVersion, profileStatus }: { companyName: string; tokenBalance: number; profileVersion: number | null; profileStatus: string }) {
  const router = useRouter();
  const [name, setName] = useState(`Партнёрская программа ${companyName}`);
  const [goal, setGoal] = useState("MIXED");
  const [currency, setCurrency] = useState("KZT");
  const [selected, setSelected] = useState(["LEAD", "DEAL"]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(type: string) {
    setSelected((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/programs/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, goal, currency, missionTypes: selected }) });
      const data = await response.json() as { programId?: string; error?: string };
      if (!response.ok || !data.programId) throw new Error(data.error || "Не удалось сгенерировать программу");
      router.push(`/dashboard/programs/${data.programId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сгенерировать программу");
      setPending(false);
    }
  }

  return (
    <div className="dashboard-content module-content program-builder-page">
      <div className="builder-back"><Link href="/dashboard/programs">← Все программы</Link><span>{profileVersion ? `AI-профиль v${profileVersion}${profileStatus === "CONFIRMED" ? " · подтверждён" : " · черновик"}` : "AI-профиль не заполнен"} · {tokenBalance.toLocaleString("ru-RU")} токенов</span></div>
      <div className="module-heading"><div><span className="module-kicker">НОВАЯ ПРОГРАММА · ШАГ 1 ИЗ 3</span><h1>Задайте рамки программы</h1><p>Gemini использует доступные данные компании и создаст редактируемый черновик каждой выбранной миссии. Подтверждение профиля не обязательно.</p></div></div>
      <div className="builder-stepper"><span className="active"><b>1</b>Основа</span><span><b>2</b>Миссии и награды</span><span><b>3</b>Правила и публикация</span></div>

      <form className="program-create-layout" onSubmit={generate}>
        <section className="panel program-basics-card">
          <div className="panel-header"><div><h2>Основа программы</h2><p>Название увидят партнёры по внешней ссылке.</p></div></div>
          <label className="builder-field"><span>Название программы</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required /></label>
          <div className="builder-field-row"><label className="builder-field"><span>Главная цель</span><select value={goal} onChange={(event) => setGoal(event.target.value)}><option value="MIXED">Смешанная программа</option><option value="LEADS">Больше квалифицированных лидов</option><option value="DEALS">Больше оплаченных сделок</option><option value="BRAND">Узнаваемость и доверие</option><option value="ENGAGEMENT">Вовлечение партнёров</option></select></label><label className="builder-field"><span>Валюта</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="KZT">KZT · ₸</option><option value="RUB">RUB · ₽</option><option value="USD">USD · $</option><option value="EUR">EUR · €</option></select></label></div>
        </section>

        <section className="panel mission-selector-card">
          <div className="panel-header"><div><h2>Выберите типы миссий</h2><p>От одной до четырёх. Для каждого типа будет создана отдельная карточка.</p></div><span>{selected.length} выбрано</span></div>
          <div className="mission-selector-grid">{missionTypes.map((mission) => { const active = selected.includes(mission.type); return <button type="button" className={`mission-select type-${mission.type.toLowerCase()} ${active ? "selected" : ""}`} onClick={() => toggle(mission.type)} key={mission.type} aria-pressed={active}><span className="mission-select-check">{active ? "✓" : "+"}</span><i>{mission.icon}</i><strong>{mission.title}</strong><small>{mission.text}</small></button>; })}</div>
        </section>

        {error && <div className="inline-notice error builder-error" role="alert">{error}</div>}
        <div className="builder-submit-bar"><div><strong>Что сделает Gemini</strong><p>Предложит действия, доказательства результата, правила проверки и стартовую награду. Всё можно изменить до публикации.</p></div><button className="button button-primary" type="submit" disabled={pending || selected.length === 0}>{pending ? "Gemini создаёт миссии…" : "Сгенерировать черновик"}<span>✦</span></button></div>
      </form>
    </div>
  );
}
