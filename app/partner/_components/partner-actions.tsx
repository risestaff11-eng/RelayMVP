"use client";

import { useState } from "react";

async function partnerAction(body: Record<string, unknown>) {
  const response = await fetch("/api/partner/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new Error(data.error || "Не удалось выполнить действие");
}

export function AcceptMissionButton({ token, missionId }: { token: string; missionId: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState("");
  async function accept() { setState("pending"); setError(""); try { await partnerAction({ token, action: "ACCEPT_MISSION", missionId }); setState("done"); } catch (reason) { setState("idle"); setError(reason instanceof Error ? reason.message : "Ошибка"); } }
  return <div className="partner-inline-action"><button type="button" onClick={accept} disabled={state !== "idle"}>{state === "pending" ? "Добавляем…" : state === "done" ? "Миссия добавлена ✓" : "Взять миссию"}</button><small aria-live="polite">{error}</small></div>;
}

export function OpportunityFilters({ companies, currencies }: { companies: string[]; currencies: string[] }) {
  const [type, setType] = useState("ALL");
  const [company, setCompany] = useState("ALL");
  const [reward, setReward] = useState("ALL");
  return <div className="opportunity-filters"><label><span>Тип результата</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="ALL">Все типы</option><option value="LEAD">Лиды</option><option value="DEAL">Сделки</option><option value="IMAGE">Имидж</option><option value="ENGAGEMENT">Вовлечение</option></select></label><label><span>Компания</span><select value={company} onChange={(event) => setCompany(event.target.value)}><option value="ALL">Все компании</option>{companies.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Награда</span><select value={reward} onChange={(event) => setReward(event.target.value)}><option value="ALL">Любая награда</option>{currencies.map((item) => <option key={item}>{item}</option>)}</select></label><small aria-live="polite">Фильтры применены · предложения обновлены</small></div>;
}

export function DisputeButton({ token, submissionId, opened }: { token: string; submissionId: string; opened: boolean }) {
  const [show, setShow] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState(opened ? "Спор открыт" : "");
  async function submit() { try { await partnerAction({ token, action: "OPEN_DISPUTE", submissionId, reason }); setNotice("Спор зафиксирован. Компания увидит его в журнале."); setShow(false); } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось открыть спор"); } }
  if (opened) return <span className="dispute-open">! Спор открыт</span>;
  return <div className="dispute-action"><button type="button" onClick={() => setShow(!show)}>Открыть спор</button>{show && <div><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Что произошло и какого решения вы ожидаете" /><button type="button" disabled={reason.trim().length < 10} onClick={submit}>Отправить спор</button></div>}<small aria-live="polite">{notice}</small></div>;
}

export function CopyTextButton({ text, label = "Скопировать" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() { await navigator.clipboard.writeText(text); setDone(true); }
  return <button className="copy-text-button" type="button" onClick={copy}>{done ? "Скопировано ✓" : label}</button>;
}

function split(value: string) { return value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean); }

export function PartnerProfileForm({ token, profile }: { token: string; profile: { skills: string[]; industries: string[]; geographies: string[]; preferredTypes: string[] } }) {
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [industries, setIndustries] = useState(profile.industries.join(", "));
  const [geographies, setGeographies] = useState(profile.geographies.join(", "));
  const [preferredTypes, setPreferredTypes] = useState(profile.preferredTypes);
  const [notice, setNotice] = useState("");
  async function save(event: React.FormEvent) { event.preventDefault(); setNotice("Сохраняем…"); try { await partnerAction({ token, action: "UPDATE_PROFILE", skills: split(skills), industries: split(industries), geographies: split(geographies), preferredTypes }); setNotice("Профиль сохранён. Рекомендации миссий обновятся."); } catch (error) { setNotice(error instanceof Error ? error.message : "Ошибка"); } }
  const types = [["LEAD", "Лиды"], ["DEAL", "Сделки"], ["IMAGE", "Имидж"], ["ENGAGEMENT", "Вовлечение"]];
  return <form className="partner-profile-form" onSubmit={save}><label><span>Компетенции</span><textarea value={skills} onChange={(event) => setSkills(event.target.value)} rows={3} placeholder="B2B-продажи, CRM, автоматизация" /></label><label><span>Отрасли</span><textarea value={industries} onChange={(event) => setIndustries(event.target.value)} rows={3} placeholder="IT, строительство, образование" /></label><label><span>География</span><input value={geographies} onChange={(event) => setGeographies(event.target.value)} placeholder="Казахстан, Алматы" /></label><fieldset><legend>Предпочитаемые миссии</legend>{types.map(([value, label]) => <label key={value}><input type="checkbox" checked={preferredTypes.includes(value)} onChange={(event) => setPreferredTypes((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} />{label}</label>)}</fieldset><button className="button button-primary" type="submit">Сохранить профиль <span>→</span></button><p aria-live="polite">{notice}</p></form>;
}
