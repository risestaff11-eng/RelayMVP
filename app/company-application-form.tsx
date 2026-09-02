"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { readMarketingAttribution } from "./marketing-analytics";

export function CompanyApplicationForm() {
  const sectionRef = useRef<HTMLElement>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => {
      document.documentElement.classList.toggle("lp-application-visible", Boolean(entry?.isIntersecting));
    }, { threshold: 0.08 });
    observer.observe(section);
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("lp-application-visible");
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = event.currentTarget;
    const data = { ...Object.fromEntries(new FormData(form).entries()), ...readMarketingAttribution() };
    try {
      const response = await fetch("/api/marketing/company-application", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось отправить заявку");
      setDone(true);
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось отправить заявку");
    } finally {
      setPending(false);
    }
  }

  return (
    <section ref={sectionRef} className="lp-company-application lp-section" id="company-application">
      <div className="lp-application-copy">
        <span>ОСТАВИТЬ ЗАЯВКУ</span>
        <h2>Разберём вашу задачу и покажем первый запуск.</h2>
        <p>Оставьте контакты. Мы свяжемся с вами и подготовим понятный пример под вашу компанию.</p>
        <ul>
          <li>Кого можно попросить о рекомендации</li>
          <li>За какого клиента и сколько платить</li>
          <li>Как принять заявку и отметить выплату</li>
        </ul>
      </div>
      <form onSubmit={submit} aria-label="Заявка компании">
        <div className="lp-application-row">
          <label><span>Ваше имя</span><input name="name" autoComplete="name" maxLength={100} required /></label>
          <label><span>Компания</span><input name="company" autoComplete="organization" maxLength={140} required /></label>
        </div>
        <div className="lp-application-row">
          <label><span>Телефон</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 700 000 00 00" maxLength={40} required /></label>
          <label><span>Email</span><input name="email" type="email" autoComplete="email" maxLength={180} /></label>
        </div>
        <label><span>Кого вы хотите привлекать?</span><textarea name="comment" rows={4} maxLength={700} placeholder="Например: владельцев стоматологий в Алматы" /></label>
        <label className="lp-form-honeypot" aria-hidden="true"><span>Сайт</span><input name="website" tabIndex={-1} autoComplete="off" /></label>
        <p>Нажимая кнопку, вы соглашаетесь с <a href="/legal/privacy">политикой конфиденциальности</a>.</p>
        {error && <div className="lp-application-error" role="alert">{error}</div>}
        {done ? <div className="lp-application-success" role="status"><b>Заявка отправлена</b><span>Мы получили ваши контакты и свяжемся с вами.</span></div> : <button type="submit" disabled={pending}>{pending ? "Отправляем…" : "Оставить заявку"}<span aria-hidden="true">↗</span></button>}
      </form>
    </section>
  );
}
