"use client";

import { useState } from "react";
import { MarketingLogo } from "../marketing-logo";

type Step = "email" | "login" | "register" | "verify-email" | "forgot" | "reset-success" | "success";

const activationWhatsAppUrl = `https://wa.me/77765086000?text=${encodeURIComponent("Я прошёл регистрацию, пожалуйста, активируйте мой кабинет.")}`;
const recoveryWhatsAppUrl = (email: string) => `https://wa.me/77765086000?text=${encodeURIComponent(`Не могу восстановить пароль Relay. Email аккаунта: ${email}`)}`;

async function post(path: string, payload: Record<string, unknown>) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json() as { error?: string; exists?: boolean; displayName?: string; redirectTo?: string; status?: string; verificationSent?: boolean; alreadyVerified?: boolean };
  if (!response.ok) throw new Error(data.error || "Не удалось выполнить запрос");
  return data;
}

export function AuthFlow({ returnTo }: { returnTo: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function reset() {
    setStep("email");
    setDisplayName("");
    setError("");
    setNotice("");
  }

  async function checkEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const data = await post("/api/auth/check-email", { email });
      setDisplayName(data.displayName || email.split("@")[0]);
      setStep(data.exists ? "login" : "register");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось продолжить"); }
    finally { setPending(false); }
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const data = await post("/api/auth/login", { ...values, email, returnTo });
      window.location.assign(data.redirectTo || "/dashboard");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось войти"); setPending(false); }
  }

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const data = await post("/api/auth/register", {
        email,
        name: form.get("name"),
        phone: form.get("phone"),
        company: form.get("company"),
        password: form.get("password"),
        acceptedTerms: form.get("acceptedTerms") === "on",
        acceptedPrivacy: form.get("acceptedPrivacy") === "on",
      });
      setStep(data.verificationSent ? "verify-email" : "success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось создать аккаунт"); }
    finally { setPending(false); }
  }

  async function confirmEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    try {
      const data = await post("/api/auth/email-verification", { action: "CONFIRM", email, code });
      window.location.assign(data.redirectTo || returnTo || "/dashboard");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось подтвердить почту"); setPending(false); }
  }

  async function resendEmailCode() {
    setPending(true); setError(""); setNotice("");
    try {
      await post("/api/auth/email-verification", { action: "REQUEST", email });
      setNotice("Новый код отправлен. Проверьте входящие и папку «Спам».");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось отправить код"); }
    finally { setPending(false); }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      await post("/api/auth/reset-password", { email, phone: form.get("phone"), password: form.get("password") });
      setStep("reset-success");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось изменить пароль"); }
    finally { setPending(false); }
  }

  return <main className="relay-auth-page"><section className="relay-auth-card">
    <div className="relay-auth-brand"><MarketingLogo /><strong>Relay</strong></div>
    {step === "email" && <><div className="relay-auth-copy"><h1>Вход в Relay</h1><p>Введите email, чтобы войти или создать новый аккаунт.</p></div><form onSubmit={checkEmail}><label><span>Email</span><input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label>{error && <p className="relay-auth-error" role="alert">{error}</p>}<button disabled={pending} type="submit">{pending ? "Проверяем…" : "Продолжить"}</button></form></>}
    {step === "login" && <><div className="relay-auth-copy"><h1>С возвращением, {displayName}</h1><p>Введите пароль для входа в кабинет компании.</p></div><form onSubmit={login}><label><span>Пароль</span><input autoComplete="current-password" name="password" type="password" required /></label><button className="relay-auth-forgot" type="button" onClick={() => { setStep("forgot"); setError(""); }}>Забыли пароль?</button>{error && <p className="relay-auth-error" role="alert">{error}</p>}<button disabled={pending} type="submit">{pending ? "Входим…" : "Войти"}</button></form><button className="relay-auth-back" type="button" onClick={reset}>← Другой email</button></>}
    {step === "register" && <><div className="relay-auth-copy"><h1>Создайте аккаунт</h1><p>Регистрация для <strong>{email}</strong>. После создания аккаунта мы отправим код для быстрого входа.</p></div><form onSubmit={register}><label><span>Имя</span><input autoComplete="name" name="name" placeholder="Иван Петров" required /></label><label><span>Телефон</span><input autoComplete="tel" name="phone" placeholder="+7 777 000 00 00" required /></label><label><span>Компания <small>необязательно</small></span><input autoComplete="organization" name="company" placeholder="Название компании" /></label><label><span>Пароль</span><input autoComplete="new-password" minLength={8} name="password" pattern="(?=.*[A-Za-z])[\x20-\x7E]{8,}" placeholder="Минимум 8 символов, латиница" title="Минимум 8 символов и хотя бы одна латинская буква" type="password" required /></label><label className="relay-auth-check"><input name="acceptedTerms" type="checkbox" required /><span>Я принимаю <a href="/legal/license" target="_blank">условия использования</a></span></label><label className="relay-auth-check"><input name="acceptedPrivacy" type="checkbox" required /><span>Я согласен на <a href="/legal/privacy" target="_blank">обработку персональных данных</a></span></label>{error && <p className="relay-auth-error" role="alert">{error}</p>}<button disabled={pending} type="submit">{pending ? "Создаём аккаунт…" : "Создать аккаунт"}</button></form><button className="relay-auth-back" type="button" onClick={reset}>← Другой email</button></>}
    {step === "verify-email" && <><div className="relay-auth-copy"><h1>Введите код из письма</h1><p>Мы отправили шестизначный код на <strong>{email}</strong>. После подтверждения кабинет активируется автоматически.</p></div><form onSubmit={confirmEmail}><label><span>Код подтверждения</span><input className="relay-auth-code" autoComplete="one-time-code" inputMode="numeric" maxLength={6} minLength={6} name="code" pattern="[0-9]{6}" placeholder="000000" required /></label>{notice && <p className="relay-auth-notice" role="status">{notice}</p>}{error && <p className="relay-auth-error" role="alert">{error}</p>}<button disabled={pending} type="submit">{pending ? "Проверяем…" : "Подтвердить и войти"}</button></form><div className="relay-auth-verify-actions"><button type="button" disabled={pending} onClick={() => void resendEmailCode()}>Отправить код повторно</button><a href={activationWhatsAppUrl} target="_blank" rel="noreferrer">Нет доступа к почте? Запросить ручную активацию ↗</a></div></>}
    {step === "forgot" && <><div className="relay-auth-copy"><h1>Создайте новый пароль</h1><p>Письмо не требуется. Подтвердите телефон, который указывали при регистрации для <strong>{email}</strong>.</p></div><form onSubmit={resetPassword}><label><span>Телефон при регистрации</span><input autoComplete="tel" name="phone" inputMode="tel" placeholder="+7 777 000 00 00" required /></label><label><span>Новый пароль</span><input autoComplete="new-password" minLength={8} name="password" pattern="(?=.*[A-Za-z])[\x20-\x7E]{8,}" placeholder="Минимум 8 символов, латиница" title="Минимум 8 символов и хотя бы одна латинская буква" type="password" required /></label>{error && <p className="relay-auth-error" role="alert">{error}</p>}<button disabled={pending} type="submit">{pending ? "Проверяем…" : "Изменить пароль"}</button></form><div className="relay-auth-recovery-actions"><button className="relay-auth-back" type="button" onClick={() => { setStep("login"); setError(""); }}>← Вернуться ко входу</button><a href={recoveryWhatsAppUrl(email)} target="_blank" rel="noreferrer">Не помню телефон — написать в WhatsApp ↗</a></div></>}
    {step === "reset-success" && <div className="relay-auth-success"><span>✓</span><h1>Пароль изменён</h1><p>Теперь войдите с новым паролем. Все старые сеансы закрыты для безопасности.</p><button className="relay-auth-primary" type="button" onClick={() => { setStep("login"); setError(""); }}>Войти в Relay</button></div>}
    {step === "success" && <div className="relay-auth-success"><span>✓</span><h1>Аккаунт создан</h1><p>Сейчас письмо с кодом отправить не удалось. Аккаунт сохранён и ожидает ручной активации администратором. После активации войдите по email и созданному паролю.</p><a className="relay-auth-whatsapp" href={activationWhatsAppUrl} target="_blank" rel="noreferrer">Запросить ручную активацию <b aria-hidden="true">↗</b></a><button className="relay-auth-home" type="button" onClick={() => { setStep("login"); setError(""); }}>Перейти ко входу</button></div>}
  </section></main>;
}
