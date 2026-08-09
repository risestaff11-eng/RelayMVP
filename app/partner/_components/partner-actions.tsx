"use client";

import { useMemo, useRef, useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";
import { typeNames } from "../_lib";

async function partnerAction(body: Record<string, unknown>) {
  const response = await fetch("/api/partner/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new Error(data.error || "Не удалось выполнить действие");
}

export function AcceptMissionButton({ token, missionId, accepted = false, resultHref }: { token: string; missionId: string; accepted?: boolean; resultHref?: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done">(accepted ? "done" : "idle");
  const [error, setError] = useState("");
  async function accept() { setState("pending"); setError(""); try { await partnerAction({ token, action: "ACCEPT_MISSION", missionId }); setState("done"); } catch (reason) { setState("idle"); setError(reason instanceof Error ? reason.message : "Ошибка"); } }
  return <div className="partner-inline-action">{state === "done" && resultHref ? <Link className="accepted-result-link" href={resultHref}>Передать результат →</Link> : <button type="button" onClick={accept} disabled={state !== "idle"}>{state === "pending" ? "Добавляем…" : state === "done" ? "Задание добавлено ✓" : "Взять задание"}</button>}<small aria-live="polite">{error}</small></div>;
}

type OpportunityMission = { id: string; type: string; title: string; description: string; rewardLabel: string; verificationRules: string; status: string };

export function OpportunityBrowser({ missions, acceptedMissionIds, token, programSlug, deadline }: { missions: OpportunityMission[]; acceptedMissionIds: string[]; token: string; programSlug: string; deadline: string }) {
  const [type, setType] = useState("ALL");
  const filtered = useMemo(() => type === "ALL" ? missions : missions.filter((mission) => mission.type === type), [missions, type]);
  return <><div className="opportunity-filters"><label><span>Что хотите рекомендовать</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="ALL">Все задания</option><option value="LEAD">Передать лид</option><option value="DEAL">Помочь со сделкой</option><option value="IMAGE">Поделиться кейсом</option><option value="ENGAGEMENT">Выполнить активность</option></select></label><small aria-live="polite">Показано заданий: {filtered.length}</small></div><section className="opportunity-grid">{filtered.map((mission) => <article className={`opportunity-card type-${mission.type.toLowerCase()}`} key={mission.id}><div><span>{typeNames[mission.type]}</span><small>● МОЖНО ЗАРАБОТАТЬ</small></div><h2>{mission.title}</h2><p>{mission.description}</p><dl><div><dt>Ваш заработок</dt><dd className="opportunity-reward-value">{mission.rewardLabel}</dd></div><div><dt>Дедлайн</dt><dd>{deadline}</dd></div><div><dt>Когда засчитают</dt><dd>{mission.verificationRules}</dd></div></dl><div className="opportunity-card-actions"><AcceptMissionButton token={token} missionId={mission.id} accepted={acceptedMissionIds.includes(mission.id)} resultHref={`/p/${programSlug}/missions/${mission.id}/submit?access=${token}`} /></div></article>)}</section>{!filtered.length && <section className="partner-large-empty"><span>◇</span><h2>Таких заданий пока нет</h2><p>Выберите другой тип — новые возможности появляются после публикации компанией.</p></section>}</>;
}

export function DisputeButton({ token, submissionId, opened }: { token: string; submissionId: string; opened: boolean }) {
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState(opened ? "Спор открыт" : "");
  async function submit() { try { await partnerAction({ token, action: "OPEN_DISPUTE", submissionId, reason }); setNotice("Спор зафиксирован. Компания увидит его в журнале."); setShow(false); } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось открыть спор"); } }
  if (opened) return <span className="dispute-open">! Спор открыт</span>;
  return <div className="dispute-action"><button type="button" onClick={() => setShow(!show)}>Открыть спор</button>{show && <div><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Что произошло и какого решения вы ожидаете" /><button type="button" disabled={reason.trim().length < 10} onClick={submit}>Отправить спор</button></div>}<small aria-live="polite">{notice}</small></div>;
}

export function RewardReceiptConfirmation({ token, rewardId, confirmed, supportHref }: { token: string; rewardId: string; confirmed: boolean; supportHref: string }) {
  const [checked, setChecked] = useState(confirmed);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  async function change(next: boolean) {
    setPending(true); setNotice("");
    try {
      await partnerAction({ token, action: "CONFIRM_REWARD", rewardId, confirmed: next });
      setChecked(next);
      setNotice(next ? "Получение подтверждено. Выплата учтена в статистике." : "Подтверждение снято.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось обновить выплату"); }
    finally { setPending(false); }
  }
  return <div className="reward-receipt-confirmation"><label><input type="checkbox" checked={checked} disabled={pending} onChange={(event) => void change(event.target.checked)} /><span>{checked ? "Деньги получены" : "Подтвердить получение"}</span></label>{!checked && <a href={supportHref} target="_blank" rel="noreferrer">Не получили деньги? Написать в поддержку</a>}<small aria-live="polite">{notice}</small></div>;
}

export function CopyTextButton({ text, label = "Скопировать" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() { await navigator.clipboard.writeText(text); setDone(true); }
  return <button className="copy-text-button" type="button" onClick={copy}>{done ? "Скопировано ✓" : label}</button>;
}

export function ContactVerification({ token, channel, value, verified }: { token: string; channel: "EMAIL" | "WHATSAPP"; value: string; verified: boolean }) {
  const [requested, setRequested] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  async function act(action: "REQUEST" | "CONFIRM") {
    setPending(true); setNotice("");
    try {
      const response = await fetch("/api/partner/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, channel, action, code }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось подтвердить контакт");
      if (action === "REQUEST") { setRequested(true); setNotice(`Код отправлен: ${value}`); }
      else { setNotice("Контакт подтверждён ✓"); window.location.reload(); }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Ошибка"); }
    finally { setPending(false); }
  }
  const label = channel === "EMAIL" ? "Email" : "WhatsApp";
  return <div className={`contact-verification ${verified ? "verified" : ""}`}><div><span>{label}</span><strong>{value || "Не указан"}</strong><small>{verified ? "✓ Подтверждён" : "Нужно подтвердить для уровня 2"}</small></div>{verified ? <b>ГОТОВО</b> : !requested ? <button type="button" disabled={pending || !value} onClick={() => act("REQUEST")}>{pending ? "Отправляем…" : "Получить код"}</button> : <div className="verification-code"><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" aria-label={`Код подтверждения ${label}`} placeholder="000000" /><button type="button" disabled={pending || code.length !== 6} onClick={() => act("CONFIRM")}>Подтвердить</button></div>}<p aria-live="polite">{notice}</p></div>;
}

export function PartnerProfileForm({ token, partner, profile }: { token: string; partner: { email: string; phone: string }; profile: { firstName: string; lastName: string; middleName: string; instagram: string; avatarObjectKey: string | null; skills: string[]; industries: string[]; geographies: string[]; preferredTypes: string[]; emailVerifiedAt: string | null; whatsappVerifiedAt: string | null } }) {
  const [notice, setNotice] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarObjectKey ? `/api/partner/avatar?token=${token}` : "");
  const avatarInput = useRef<HTMLInputElement>(null);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice("Сохраняем профиль…");
    const form = new FormData(event.currentTarget); form.set("token", token);
    try {
      const response = await fetch("/api/partner/profile", { method: "POST", body: form });
      const data = await response.json() as { avatarUrl?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось сохранить профиль");
      if (data.avatarUrl) setAvatarUrl(`${data.avatarUrl}&v=${Date.now()}`);
      setNotice("Профиль сохранён. Подбор заданий обновлён.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Ошибка"); }
  }
  const types = [["LEAD", "Лиды"], ["DEAL", "Сделки"], ["IMAGE", "Имидж"], ["ENGAGEMENT", "Вовлечение"]];
  const initials = `${profile.firstName[0] || ""}${profile.lastName[0] || ""}`.toUpperCase() || "P";
  return <div className="partner-profile-stack"><section className="partner-verification-panel"><div><span>ЗАЩИТА АККАУНТА</span><h2>Подтвердите контакты, когда будет удобно</h2><p>Для начала достаточно имени и WhatsApp. Подтверждение контактов понадобится только для повышения уровня и дополнительных преимуществ.</p></div><ContactVerification token={token} channel="EMAIL" value={partner.email} verified={Boolean(profile.emailVerifiedAt)} /><ContactVerification token={token} channel="WHATSAPP" value={partner.phone} verified={Boolean(profile.whatsappVerifiedAt)} /></section><form className="partner-profile-form" onSubmit={save}><div className="partner-avatar-editor"><button className="partner-avatar-upload" type="button" onClick={() => avatarInput.current?.click()} aria-label="Загрузить или изменить аватар">{avatarUrl ? <img src={avatarUrl} alt="Аватар агента" /> : <span>{initials}</span>}<i>＋</i></button><div><strong>Нажмите на аватар, чтобы изменить его</strong><small>JPG, PNG или WEBP до 5 МБ</small></div><input ref={avatarInput} name="avatar" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) setAvatarUrl(URL.createObjectURL(file)); }} /></div><div className="partner-profile-fields"><label><span>Имя *</span><input name="firstName" defaultValue={profile.firstName} required /></label><label><span>WhatsApp *</span><input name="phone" type="tel" defaultValue={partner.phone} required placeholder="+7 700 000 00 00" /></label><label><span>Фамилия</span><input name="lastName" defaultValue={profile.lastName} /></label><label><span>Отчество</span><input name="middleName" defaultValue={profile.middleName} /></label><label><span>Email для входа</span><input name="email" type="email" defaultValue={partner.email} required readOnly aria-readonly="true" /></label><label><span>Instagram</span><input name="instagram" defaultValue={profile.instagram} placeholder="username" /></label></div><label><span>География</span><input name="geographies" defaultValue={profile.geographies.join(", ")} placeholder="Казахстан, Алматы" /></label><label><span>Компетенции</span><textarea name="skills" defaultValue={profile.skills.join(", ")} rows={3} placeholder="B2B-продажи, CRM, автоматизация" /></label><label><span>Отрасли</span><textarea name="industries" defaultValue={profile.industries.join(", ")} rows={3} placeholder="IT, строительство, образование" /></label><fieldset><legend>Какие задания вам интересны</legend>{types.map(([value, label]) => <label key={value}><input name="preferredTypes" value={value} type="checkbox" defaultChecked={profile.preferredTypes.includes(value)} />{label}</label>)}</fieldset><button className="button button-primary" type="submit">Сохранить профиль <span>→</span></button><p aria-live="polite">{notice}</p></form></div>;
}
