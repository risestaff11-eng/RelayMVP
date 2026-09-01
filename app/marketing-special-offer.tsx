"use client";

import { useEffect, useRef, useState } from "react";

const sessionKey = "relay_special_offer_seen";

export function MarketingSpecialOffer() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(sessionKey)) return;
    } catch {
      // The offer can still work when browser storage is unavailable.
    }

    const offerSection = document.getElementById("offer");
    if (!offerSection) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      if (window.location.hash === "#company-application") {
        observer.disconnect();
        return;
      }
      try {
        window.sessionStorage.setItem(sessionKey, "shown");
      } catch {
        // Storage is optional; showing the offer is the primary action.
      }
      setOpen(true);
      observer.disconnect();
    }, { threshold: 0.35 });

    observer.observe(offerSection);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!open) return null;

  return <div className="lp-special-offer-backdrop">
    <button className="lp-special-offer-dismiss" type="button" onClick={() => setOpen(false)} aria-label="Закрыть спецпредложение" />
    <section className="lp-special-offer" role="dialog" aria-modal="true" aria-labelledby="special-offer-title" aria-describedby="special-offer-copy">
      <button ref={closeButtonRef} className="lp-special-offer-close" type="button" onClick={() => setOpen(false)} aria-label="Закрыть">×</button>
      <span>ТОЛЬКО 20 КОМПАНИЙ НА БЛИЖАЙШИЙ ПЕРСОНАЛЬНЫЙ ЗАПУСК</span>
      <h2 id="special-offer-title">Соберём первую программу RiseStaff вместе с вами.</h2>
      <p id="special-offer-copy">За одну рабочую встречу разберём продукт и подготовим основу программы к публикации.</p>
      <ul className="lp-special-offer-kit">
        <li><b>01</b><span><strong>4 готовых задания</strong>По одному для каждого типа</span></li>
        <li><b>02</b><span><strong>Форма передачи результата</strong>Поля и подтверждения для агента</span></li>
        <li><b>03</b><span><strong>Правила проверки</strong>Статусы, награды и причины отказа</span></li>
      </ul>
      <div className="lp-special-offer-limit"><b>20</b><span><strong>Только 20 компаний</strong>Набор закроется после заполнения двадцати мест</span></div>
      <a href="#company-application" onClick={() => setOpen(false)} data-track="special_offer_application">Оставить заявку <span aria-hidden="true">↗</span></a>
      <button className="lp-special-offer-later" type="button" onClick={() => setOpen(false)}>Продолжить знакомство с RiseStaff</button>
    </section>
  </div>;
}
