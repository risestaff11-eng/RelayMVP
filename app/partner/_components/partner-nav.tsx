"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";

const items = [
  ["", "Главная", "⌂"],
  ["/opportunities", "Возможности", "✦"],
  ["/missions", "Мои задания", "◉"],
  ["/submissions", "Лиды и сделки", "↗"],
  ["/payouts", "Выплаты", "₸"],
  ["/materials", "Материалы", "▤"],
  ["/profile", "Профиль", "○"],
] as const;

const primaryMobileItems = items.slice(0, 4);
const secondaryMobileItems = items.slice(4);

export function PartnerNav({ token }: { token: string }) {
  const pathname = usePathname();
  const root = `/partner/${token}`;
  const [moreOpen, setMoreOpen] = useState(false);
  const hrefFor = (suffix: string) => `${root}${suffix}`;
  const isActive = (suffix: string) => suffix ? pathname.startsWith(hrefFor(suffix)) : pathname === root;
  const secondaryActive = secondaryMobileItems.some(([suffix]) => isActive(suffix));

  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [moreOpen]);

  return <>
    <nav className="partner-nav" aria-label="Навигация агента">
      {items.map(([suffix, label, icon]) => { const href = hrefFor(suffix); const active = isActive(suffix); return <Link className={active ? "active" : undefined} aria-current={active ? "page" : undefined} href={href} key={suffix}><i>{icon}</i><span>{label}</span></Link>; })}
    </nav>

    <nav className="agent-mobile-nav" aria-label="Основная навигация агента">
      {primaryMobileItems.map(([suffix, label, icon]) => { const href = hrefFor(suffix); const active = isActive(suffix); return <Link className={active ? "active" : undefined} aria-current={active ? "page" : undefined} href={href} key={suffix}><i>{icon}</i><span>{suffix === "/submissions" ? "Результаты" : label}</span></Link>; })}
      <button className={secondaryActive || moreOpen ? "active" : undefined} type="button" aria-expanded={moreOpen} aria-controls="agent-mobile-more" onClick={() => setMoreOpen((value) => !value)}><i>•••</i><span>Ещё</span></button>
    </nav>

    {moreOpen && <button className="mobile-nav-scrim" type="button" aria-label="Закрыть меню" onClick={() => setMoreOpen(false)} />}
    <section className={`mobile-more-sheet agent-more-sheet ${moreOpen ? "open" : ""}`} id="agent-mobile-more" aria-hidden={!moreOpen}>
      <div className="mobile-sheet-handle" />
      <div className="mobile-sheet-heading"><div><small>ЛИЧНЫЙ КАБИНЕТ</small><strong>Доход и профиль</strong></div><button type="button" aria-label="Закрыть меню" onClick={() => setMoreOpen(false)}>×</button></div>
      <div className="mobile-sheet-links">
        {secondaryMobileItems.map(([suffix, label, icon]) => <Link key={suffix} className={isActive(suffix) ? "active" : undefined} href={hrefFor(suffix)} onClick={() => setMoreOpen(false)}><i>{icon}</i><span><strong>{label}</strong><small>{suffix === "/payouts" ? "Начисления и даты выплат" : suffix === "/materials" ? "Сообщения, кейсы и презентации" : "Данные, контакты и уровень"}</small></span><b>→</b></Link>)}
      </div>
    </section>
  </>;
}
