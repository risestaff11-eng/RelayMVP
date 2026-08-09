"use client";

import { useMemo, useState } from "react";

type RewardItem = { amount: number; status: string; partnerConfirmedAt: string | null; createdAt: string; type: string };

export function ProfileEarningsSummary({ rewards, currency, missionCount, bestReward, calculatedAt }: { rewards: RewardItem[]; currency: string; missionCount: number; bestReward: string; calculatedAt: number }) {
  const [period, setPeriod] = useState("ALL");
  const [type, setType] = useState("ALL");
  const filtered = useMemo(() => rewards.filter((reward) => {
    const withinPeriod = period === "ALL" || new Date(reward.createdAt).getTime() >= calculatedAt - Number(period) * 86400000;
    return withinPeriod && (type === "ALL" || reward.type === type);
  }), [calculatedAt, period, rewards, type]);
  const format = (value: number) => new Intl.NumberFormat("ru-RU").format(value) + ` ${currency}`;
  const received = filtered.filter((item) => item.status === "PAID" && item.partnerConfirmedAt).reduce((sum, item) => sum + item.amount, 0);
  const due = filtered.filter((item) => item.status === "APPROVED").reduce((sum, item) => sum + item.amount, 0);
  const expected = filtered.filter((item) => item.status === "PENDING").reduce((sum, item) => sum + item.amount, 0);
  return <section className="profile-earnings-summary"><div><span>СВОДКА ПО ЗАРАБОТКУ</span><h2>Ваши деньги и возможности</h2><p>Фильтры меняют только финансовую историю. Доступные задания показаны отдельно.</p></div><div className="profile-earning-filters"><label><span>Период</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="ALL">За всё время</option><option value="30">Последние 30 дней</option><option value="90">Последние 90 дней</option></select></label><label><span>Тип задания</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="ALL">Все типы</option><option value="LEAD">Лиды</option><option value="DEAL">Сделки</option><option value="IMAGE">Имидж</option><option value="ENGAGEMENT">Вовлечение</option></select></label></div><div className="profile-earning-metrics"><article><small>ПОЛУЧЕНО</small><strong>{format(received)}</strong></article><article><small>К ВЫПЛАТЕ</small><strong>{format(due)}</strong></article><article><small>ОЖИДАЕТСЯ</small><strong>{format(expected)}</strong></article><article className="accent"><small>ДОСТУПНО СЕЙЧАС</small><strong>{missionCount} заданий</strong><span>{bestReward ? `до ${bestReward}` : "новые задания скоро"}</span></article></div></section>;
}

export function PartnerExitButton() {
  return <button className="partner-exit-button" type="button" onClick={() => window.location.replace("/")}>Выйти из кабинета</button>;
}
