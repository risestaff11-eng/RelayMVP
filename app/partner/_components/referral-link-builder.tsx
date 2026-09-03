"use client";

import { useState } from "react";

type Mission = { id: string; title: string; programName: string; rewardLabel: string; type: string };

export function ReferralLinkBuilder({ token, missions }: { token: string; missions: Mission[] }) {
  const [selectedId, setSelectedId] = useState(missions[0]?.id || "");
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  async function createLink() {
    if (!selectedId) return;
    setPending(true); setNotice(""); setUrl("");
    try {
      const response = await fetch("/api/partner/referrals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, missionId: selectedId }) });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Не удалось создать ссылку");
      setUrl(data.url); setNotice("Ссылка готова. Отправьте её клиенту — результат будет закреплён за вами.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось создать ссылку"); }
    finally { setPending(false); }
  }

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setNotice("Ссылка скопирована");
  }

  async function shareLink() {
    if (!url) return;
    const mission = missions.find((item) => item.id === selectedId);
    if (navigator.share) await navigator.share({ title: mission?.title || "Рекомендация", text: "Заполните короткую форму — я передам ваш запрос компании.", url });
    else await copyLink();
  }

  if (!missions.length) return <section className="partner-large-empty"><span>↗</span><h2>Сначала возьмите задание</h2><p>Реферальная ссылка доступна для заданий на лид или сделку, которые вы взяли в работу.</p><a className="button button-primary" href={`/partner/${token}/opportunities`}>Выбрать задание <span>→</span></a></section>;

  return <section className="referral-builder panel">
    <div className="referral-explainer"><span>01</span><div><strong>Выберите задание</strong><p>Клиент увидит только название компании и короткую форму: имя, контакт и комментарий.</p></div></div>
    <label><span>Задание</span><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setUrl(""); setNotice(""); }}>{missions.map((mission) => <option key={mission.id} value={mission.id} data-no-translate>{mission.programName} · {mission.title} · {mission.rewardLabel}</option>)}</select></label>
    <button className="button button-primary referral-create-button" type="button" disabled={pending} onClick={() => void createLink()}>{pending ? "Создаём…" : "Создать ссылку"}<span>→</span></button>
    {url && <div className="referral-ready"><small>ВАША ССЫЛКА</small><a href={url} target="_blank" rel="noreferrer">{url}</a><div><button type="button" onClick={() => void copyLink()}>Копировать</button><button type="button" onClick={() => void shareLink()}>Отправить клиенту</button></div><p>Ссылка действует 180 дней и ведёт только на форму клиента. Доступ к вашему кабинету закрыт.</p></div>}
    {notice && <p className="referral-notice" role="status">{notice}</p>}
  </section>;
}
