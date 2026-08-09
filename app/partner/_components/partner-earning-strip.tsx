"use client";

import { useEffect, useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";

type GoalData = { target: number; commission: number; resultType: "lead" | "deal" };

function noun(count: number, words: [string, string, string]) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  return mod100 >= 11 && mod100 <= 19 ? words[2] : mod10 === 1 ? words[0] : mod10 >= 2 && mod10 <= 4 ? words[1] : words[2];
}

export function PartnerEarningStrip({ token, activeCount, bestReward }: { token: string; activeCount: number; bestReward?: string }) {
  const [visible, setVisible] = useState(true);
  const [goal, setGoal] = useState<GoalData | null>(null);

  useEffect(() => {
    const readGoal = () => {
      try { setGoal(JSON.parse(localStorage.getItem("relay-agent-earnings-goal") || "null")); } catch { setGoal(null); }
    };
    const timer = window.setTimeout(readGoal, 0);
    const onGoal = (event: Event) => setGoal((event as CustomEvent<GoalData>).detail);
    window.addEventListener("relayearningsgoal", onGoal);
    return () => { window.clearTimeout(timer); window.removeEventListener("relayearningsgoal", onGoal); };
  }, []);

  if (!visible) return null;
  const needed = goal?.target && goal.commission ? Math.ceil(goal.target / goal.commission) : 0;
  const unit = noun(needed, goal?.resultType === "lead" ? ["лид", "лида", "лидов"] : ["сделка", "сделки", "сделок"]);
  const taskWord = noun(activeCount, ["задание", "задания", "заданий"]);

  return (
    <div className="partner-earning-strip">
      <Link href={`/partner/${token}/opportunities`}><span>Заработок:</span> <b>{activeCount} {taskWord}{bestReward ? ` · до ${bestReward}` : ""}</b></Link>
      <i aria-hidden="true">·</i>
      <Link className="partner-goal-strip" href={`/partner/${token}/payouts`}>
        {needed > 0 ? <><span>Цель:</span> <b>{goal?.target.toLocaleString("ru-RU")} ₸ · {needed} {unit}</b></> : <b>Установить цель →</b>}
      </Link>
      <button type="button" aria-label="Скрыть подсказку" onClick={() => setVisible(false)}>×</button>
    </div>
  );
}
