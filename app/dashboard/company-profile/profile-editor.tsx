"use client";

import { useMemo, useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";
import type { CompanyProfile } from "../../../db/profile";

type FormState = {
  businessDescription: string;
  products: string;
  targetAudience: string;
  advantages: string;
  buyingTriggers: string;
  disqualifiers: string;
  geographies: string;
  partnerPitch: string;
};

function lines(values: string[]) {
  return values.join("\n");
}

function list(value: string) {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function formFromProfile(profile: CompanyProfile | null): FormState {
  return {
    businessDescription: profile?.businessDescription ?? "",
    products: lines(profile?.products ?? []),
    targetAudience: profile?.targetAudience ?? "",
    advantages: lines(profile?.advantages ?? []),
    buyingTriggers: lines(profile?.buyingTriggers ?? []),
    disqualifiers: lines(profile?.disqualifiers ?? []),
    geographies: lines(profile?.geographies ?? []),
    partnerPitch: profile?.partnerPitch ?? "",
  };
}

function messageFromResponse(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") return data.error;
  return fallback;
}

export function CompanyProfileEditor({
  company,
  initialProfile,
}: {
  company: { id: string; name: string; website: string; industry: string; aiTokenBalance: number };
  initialProfile: CompanyProfile | null;
}) {
  const [website, setWebsite] = useState(company.website);
  const [savedWebsite, setSavedWebsite] = useState(company.website);
  const [profile, setProfile] = useState(initialProfile);
  const [form, setForm] = useState(() => formFromProfile(initialProfile));
  const [, setTokenBalance] = useState(company.aiTokenBalance);
  const [pending, setPending] = useState<"website" | "analysis" | "save" | "confirm" | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const profileMatchesWebsite = profile?.sourceWebsite === savedWebsite;
  const editable = profile?.status === "DRAFT" && profileMatchesWebsite;
  const missing = useMemo(() => profile?.missingFields ?? [], [profile]);

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function profilePayload(id: string) {
    return {
      id,
      businessDescription: form.businessDescription,
      products: list(form.products),
      targetAudience: form.targetAudience,
      advantages: list(form.advantages),
      buyingTriggers: list(form.buyingTriggers),
      disqualifiers: list(form.disqualifiers),
      geographies: list(form.geographies),
      partnerPitch: form.partnerPitch,
    };
  }

  async function saveWebsite(event: React.FormEvent) {
    event.preventDefault();
    setPending("website");
    setNotice(null);
    try {
      const response = await fetch("/api/company/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ website }) });
      const data = await response.json() as { website?: string; error?: string };
      if (!response.ok || !data.website) throw new Error(messageFromResponse(data, "Не удалось сохранить сайт"));
      setWebsite(data.website);
      setSavedWebsite(data.website);
      setNotice({ type: "success", text: data.website === profile?.sourceWebsite ? "Сайт сохранён." : "Сайт изменён. Запустите новый AI-анализ и подтвердите его результат." });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Не удалось сохранить сайт" });
    } finally {
      setPending(null);
    }
  }

  async function analyze() {
    setPending("analysis");
    setNotice(null);
    try {
      const response = await fetch("/api/company/profile/analyze", { method: "POST" });
      const data = await response.json() as { profile?: CompanyProfile; aiTokenBalance?: number; creditsSpent?: number; warning?: string | null; error?: string };
      if (!response.ok || !data.profile) throw new Error(messageFromResponse(data, "AI-анализ не выполнен"));
      setProfile(data.profile);
      setForm(formFromProfile(data.profile));
      if (typeof data.aiTokenBalance === "number") setTokenBalance(data.aiTokenBalance);
      const spend = typeof data.creditsSpent === "number" ? ` Списано: ${data.creditsSpent} AI-кредитов.` : "";
      setNotice({ type: "success", text: data.warning ? `Черновик версии ${data.profile.versionNumber} готов.${spend} ${data.warning}` : `Черновик версии ${data.profile.versionNumber} готов.${spend} Проверьте каждое поле и обязательно подтвердите профиль.` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "AI-анализ не выполнен" });
    } finally {
      setPending(null);
    }
  }

  async function persistProfile(kind: "save" | "confirm") {
    if (!profile) return null;
    setPending(kind);
    setNotice(null);
    try {
      const response = await fetch("/api/company/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(profilePayload(profile.id)) });
      const data = await response.json() as { profile?: CompanyProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(messageFromResponse(data, "Не удалось сохранить профиль"));
      setProfile(data.profile);
      setForm(formFromProfile(data.profile));
      if (kind === "save") setNotice({ type: "success", text: "Правки сохранены в черновике. Они ещё не подтверждены." });
      return data.profile;
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Не удалось сохранить профиль" });
      setPending(null);
      return null;
    } finally {
      if (kind === "save") setPending(null);
    }
  }

  async function confirmProfile() {
    const saved = await persistProfile("confirm");
    if (!saved) return;
    try {
      const response = await fetch("/api/company/profile/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: saved.id }) });
      const data = await response.json() as { profile?: CompanyProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(messageFromResponse(data, "Не удалось подтвердить профиль"));
      setProfile(data.profile);
      setNotice({ type: "success", text: `Версия ${data.profile.versionNumber} подтверждена. Теперь её можно использовать для генерации заданий.` });
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Не удалось подтвердить профиль" });
    } finally {
      setPending(null);
    }
  }

  const statusLabel = !profileMatchesWebsite
    ? "Нужен новый анализ"
    : profile?.status === "CONFIRMED"
      ? `Версия ${profile.versionNumber} подтверждена`
      : profile
        ? `Версия ${profile.versionNumber} — черновик`
        : "Профиль ещё не создан";

  return (
    <div className="dashboard-content module-content profile-editor-page">
      <div className="module-heading profile-page-heading">
        <div><span className="module-kicker">ПРОФИЛЬ КОМПАНИИ</span><h1>Проверьте, что Yaler понял ваш бизнес</h1><p>Yaler собирает факты с сайта, а вы исправляете неточности и подтверждаете готовую версию.</p></div>
        <div className="heading-actions"><Link className="button button-ghost compact-button" href="/dashboard/settings">Настройки профиля →</Link></div>
      </div>

      {notice && <div className={`inline-notice ${notice.type}`} role="status">{notice.text}</div>}

      <section className="panel website-settings-card">
        <div className="panel-header"><div><h2>Сайт — источник анализа</h2><p>Адрес можно изменить в любой момент. После изменения старый профиль не применяется автоматически.</p></div><span className={profileMatchesWebsite ? "status-ok" : "status-warning"}>{profileMatchesWebsite ? "● Актуален" : "● Устарел"}</span></div>
        <form className="website-form" onSubmit={saveWebsite}>
          <label htmlFor="company-website">Сайт компании</label>
          <div><input id="company-website" type="url" value={website} onChange={(event) => setWebsite(event.target.value)} required /><button type="submit" disabled={pending !== null}>{pending === "website" ? "Сохраняем…" : "Сохранить сайт"}</button></div>
        </form>
        <div className="website-actions-row"><a href={savedWebsite} target="_blank" rel="noreferrer">Открыть сайт ↗</a><span>Расход будет показан после анализа</span><button className="button button-primary" type="button" onClick={analyze} disabled={pending !== null}>{pending === "analysis" ? "Yaler анализирует сайт…" : profile ? "Обновить данные с Yaler" : "Собрать данные с Yaler"}<span>✦</span></button></div>
      </section>

      <div className="profile-status-row">
        <div><small>ТЕКУЩАЯ ВЕРСИЯ</small><strong>{statusLabel}</strong></div>
        {profile && <div><small>ИСТОЧНИК</small><strong>{profile.sourceWebsite}</strong></div>}
      </div>

      {!profile ? (
        <section className="panel profile-empty-state"><div className="profile-empty-icon">✦</div><h2>Профиль компании пока не собран</h2><p>Yaler прочитает открытые страницы сайта и создаст редактируемый черновик.</p></section>
      ) : !profileMatchesWebsite ? (
        <section className="panel profile-empty-state warning-state"><div className="profile-empty-icon">↻</div><h2>Сайт изменился</h2><p>Версия {profile.versionNumber} была создана для другого адреса. Запустите новый анализ; до подтверждения прежний профиль остаётся историей.</p></section>
      ) : (
        <section className="panel profile-draft-card">
          <div className="panel-header"><div><h2>{editable ? "Проверьте и дополните черновик" : "Подтверждённый профиль"}</h2><p>{editable ? "Пустые поля — это честные пробелы AI. Заполните их вручную перед подтверждением." : "Эта версия защищена от случайных изменений. Новый анализ создаст отдельный черновик."}</p></div><span className={profile.status === "CONFIRMED" ? "confirmed-badge" : "draft-badge"}>{profile.status === "CONFIRMED" ? "✓ Подтверждено" : "Черновик · нужно подтвердить"}</span></div>

          {missing.length > 0 && editable && <div className="missing-fields"><strong>AI не нашёл:</strong>{missing.map((item) => <span key={item}>{item}</span>)}</div>}

          <div className="profile-fields-grid">
            <label className="profile-field full"><span>Описание бизнеса <i>обязательно</i></span><textarea rows={4} value={form.businessDescription} onChange={(event) => updateField("businessDescription", event.target.value)} readOnly={!editable} /></label>
            <label className="profile-field"><span>Продукты и услуги <i>каждый с новой строки</i></span><textarea rows={6} value={form.products} onChange={(event) => updateField("products", event.target.value)} readOnly={!editable} /></label>
            <label className="profile-field"><span>Целевая аудитория <i>обязательно</i></span><textarea rows={6} value={form.targetAudience} onChange={(event) => updateField("targetAudience", event.target.value)} readOnly={!editable} /></label>
            <label className="profile-field"><span>Ключевые преимущества</span><textarea rows={6} value={form.advantages} onChange={(event) => updateField("advantages", event.target.value)} readOnly={!editable} /></label>
            <label className="profile-field"><span>Триггеры покупки</span><textarea rows={6} value={form.buyingTriggers} onChange={(event) => updateField("buyingTriggers", event.target.value)} readOnly={!editable} /></label>
            <label className="profile-field"><span>Неподходящие клиенты</span><textarea rows={5} value={form.disqualifiers} onChange={(event) => updateField("disqualifiers", event.target.value)} readOnly={!editable} /></label>
            <label className="profile-field"><span>География продаж</span><textarea rows={5} value={form.geographies} onChange={(event) => updateField("geographies", event.target.value)} readOnly={!editable} /></label>
            <label className="profile-field full"><span>Питч для агента <i>обязательно</i></span><textarea rows={4} value={form.partnerPitch} onChange={(event) => updateField("partnerPitch", event.target.value)} readOnly={!editable} /></label>
          </div>

          {editable ? <div className="profile-confirm-bar"><div><strong>AI ничего не публикует сам</strong><p>Подтверждение фиксирует именно эту версию. Следующий анализ снова потребует вашего решения.</p></div><div><button className="button button-ghost" type="button" onClick={() => persistProfile("save")} disabled={pending !== null}>{pending === "save" ? "Сохраняем…" : "Сохранить черновик"}</button><button className="button button-primary" type="button" onClick={confirmProfile} disabled={pending !== null}>{pending === "confirm" ? "Подтверждаем…" : "Подтвердить профиль"}<span>✓</span></button></div></div> : <div className="profile-confirm-bar confirmed"><div><strong>Версия подтверждена</strong><p>Можно переходить к созданию программы и генерации заданий.</p></div><Link className="button button-primary" href="/dashboard/programs">Перейти к заданиям <span>→</span></Link></div>}
        </section>
      )}
    </div>
  );
}
