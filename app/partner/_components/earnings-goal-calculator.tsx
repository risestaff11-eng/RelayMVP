"use client";

import { useEffect, useState } from "react";

type GoalData = { target: number; commission: number; resultType: "lead" | "deal" };
const STORAGE_KEY = "relay-agent-earnings-goal";

function loadGoal(): GoalData {
  if (typeof window === "undefined") return { target: 0, commission: 0, resultType: "deal" };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || { target: 0, commission: 0, resultType: "deal" };
  } catch {
    return { target: 0, commission: 0, resultType: "deal" };
  }
}

function resultWord(count: number, type: GoalData["resultType"]) {
  const words = type === "lead" ? ["лид", "лида", "лидов"] : ["сделка", "сделки", "сделок"];
  const mod100 = count % 100;
  const mod10 = count % 10;
  return mod100 >= 11 && mod100 <= 19 ? words[2] : mod10 === 1 ? words[0] : mod10 >= 2 && mod10 <= 4 ? words[1] : words[2];
}

export function EarningsGoalCalculator() {
  const [goal, setGoal] = useState<GoalData>({ target: 0, commission: 0, resultType: "deal" });
  useEffect(() => {
    const timer = window.setTimeout(() => setGoal(loadGoal()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const needed = goal.target > 0 && goal.commission > 0 ? Math.ceil(goal.target / goal.commission) : 0;
  const weekly = needed ? Math.max(1, Math.ceil(needed / 4)) : 0;

  const update = (next: GoalData) => {
    setGoal(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("relayearningsgoal", { detail: next }));
  };

  return (
    <section className="earnings-goal-card">
      <div className="earnings-goal-copy"><small>ЦЕЛЬ ЗАРАБОТКА</small><h2>Сколько рекомендаций нужно?</h2><p>Введите цель — Relay рассчитает темп.</p></div>
      <div className="earnings-goal-fields">
        <label><span>Хочу в месяц</span><div><input type="number" min="0" inputMode="numeric" value={goal.target || ""} placeholder="500 000" onChange={(event) => update({ ...goal, target: Number(event.target.value) })} /><b>₸</b></div></label>
        <label><span>Средняя комиссия</span><div><input type="number" min="0" inputMode="numeric" value={goal.commission || ""} placeholder="50 000" onChange={(event) => update({ ...goal, commission: Number(event.target.value) })} /><b>₸</b></div></label>
        <label><span>Платят за</span><select value={goal.resultType} onChange={(event) => update({ ...goal, resultType: event.target.value as GoalData["resultType"] })}><option value="lead">Лид</option><option value="deal">Сделку</option></select></label>
      </div>
      <div className={`earnings-goal-result ${needed ? "ready" : ""}`}>
        <small>ВАШ ПЛАН</small>
        {needed ? <><strong>{needed} {resultWord(needed, goal.resultType)} в месяц</strong><span>≈ {weekly} в неделю</span></> : <><strong>Введите две суммы</strong><span>И сразу увидите план</span></>}
      </div>
    </section>
  );
}
