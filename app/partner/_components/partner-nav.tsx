"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";

const items = [
  ["", "Главная", "Ваш следующий шаг", "⌂"],
  ["/opportunities", "Возможности", "Доступные задания", "✦"],
  ["/missions", "Мои задания", "Что взято в работу", "◎"],
  ["/submissions", "Лиды и сделки", "Статусы ваших результатов", "↗"],
  ["/payouts", "Выплаты", "Начисления и даты выплат", "₸"],
  ["/materials", "База знаний", "Компания, сообщения и материалы", "▤"],
  ["/profile", "Профиль", "Ваши данные и заработок", "○"],
] as const;

export function PartnerNav({ token }: { token: string }) {
  const pathname = usePathname();
  const root = `/partner/${token}`;
  const [open, setOpen] = useState(false);
  const hrefFor = (suffix: string) => `${root}${suffix}`;
  const isActive = (suffix: string) => suffix ? pathname.startsWith(hrefFor(suffix)) : pathname === root;

  useEffect(() => {
    document.body.classList.toggle("mobile-drawer-open", open);
    if (!open) return () => document.body.classList.remove("mobile-drawer-open");
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("mobile-drawer-open"); };
  }, [open]);

  return <>
    <nav className="partner-nav" aria-label="Навигация агента">
      {items.map(([suffix, label, , icon]) => <Link className={isActive(suffix) ? "active" : undefined} aria-current={isActive(suffix) ? "page" : undefined} href={hrefFor(suffix)} key={suffix}><i aria-hidden="true">{icon}</i><span>{label}</span></Link>)}
    </nav>

    <button className="mobile-menu-trigger agent-menu-trigger" type="button" aria-label="Открыть меню" aria-expanded={open} aria-controls="agent-mobile-drawer" onClick={() => setOpen(true)}><i /><i /><i /></button>
    {open && <button className="mobile-drawer-scrim" type="button" aria-label="Закрыть меню" onClick={() => setOpen(false)} />}
    <aside className={`mobile-side-drawer agent-side-drawer ${open ? "open" : ""}`} id="agent-mobile-drawer" aria-hidden={!open} inert={!open} role="dialog" aria-modal="true" aria-label="Меню кабинета агента">
      <header><div className="mobile-drawer-brand"><span>R</span><div><small>RELAY</small><strong>КАБИНЕТ АГЕНТА</strong></div></div><button type="button" aria-label="Закрыть меню" onClick={() => setOpen(false)}>×</button></header>
      <nav aria-label="Мобильная навигация агента">
        {items.map(([suffix, label, hint, icon]) => <Link key={suffix} className={isActive(suffix) ? "active" : undefined} href={hrefFor(suffix)} aria-current={isActive(suffix) ? "page" : undefined} onClick={() => setOpen(false)}><i aria-hidden="true">{icon}</i><span><strong>{label}</strong><small>{hint}</small></span><b aria-hidden="true">→</b></Link>)}
      </nav>
      <footer className="mobile-telegram-footer"><a href="https://t.me/relayagents" target="_blank" rel="noreferrer"><i>↗</i><span><strong>Relay Agents</strong><small>Telegram-канал для всех агентов</small></span><b>Открыть</b></a></footer>
    </aside>
  </>;
}
