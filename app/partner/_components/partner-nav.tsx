"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";
import { MarketingLogo } from "@/app/marketing-logo";

const items = [
  ["", "Главная", "Ваш следующий шаг", "⌂"],
  ["/opportunities", "Возможности", "Доступные задания", "✦"],
  ["/missions", "Мои задания", "Что взято в работу", "◎"],
  ["/submissions", "Мои заявки", "Решения компании и статусы", "↗"],
  ["/payouts", "Выплаты", "Начисления и даты выплат", "₸"],
  ["/materials", "База знаний", "Компания, сообщения и материалы", "▤"],
  ["/referral", "Реферальная ссылка", "Клиент сам передаст контакт", "↗"],
  ["/profile", "Профиль", "Ваши данные и заработок", "○"],
] as const;

export function PartnerNav({ token }: { token: string }) {
  const pathname = usePathname();
  const root = `/partner/${token}`;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hrefFor = (suffix: string) => `${root}${suffix}`;
  const isActive = (suffix: string) => suffix ? pathname.startsWith(hrefFor(suffix)) : pathname === root;

  const closeMenu = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus({ preventScroll: true }), 150);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("mobile-drawer-open", open);
    if (!open) return () => document.body.classList.remove("mobile-drawer-open");
    window.setTimeout(() => closeRef.current?.focus(), 0);
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") closeMenu(); };
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("mobile-drawer-open"); };
  }, [open, closeMenu]);

  return <>
    <nav className="partner-nav" aria-label="Навигация агента">
      {items.map(([suffix, label, , icon]) => <Link className={isActive(suffix) ? "active" : undefined} aria-current={isActive(suffix) ? "page" : undefined} href={hrefFor(suffix)} key={suffix}><i aria-hidden="true">{icon}</i><span>{label}</span></Link>)}
    </nav>

    <button ref={triggerRef} className="mobile-menu-trigger agent-menu-trigger" type="button" aria-label="Открыть меню" aria-expanded={open} aria-controls="agent-mobile-drawer" onClick={() => setOpen(true)}><i /><i /><i /></button>
    {open && <button className="mobile-drawer-scrim" type="button" aria-label="Закрыть меню" onClick={closeMenu} />}
    <aside className={`mobile-side-drawer agent-side-drawer ${open ? "open" : ""}`} id="agent-mobile-drawer" aria-hidden={!open} inert={!open} role="dialog" aria-modal="true" aria-label="Меню кабинета агента">
      <header><div className="mobile-drawer-brand"><div className="mobile-drawer-logo"><MarketingLogo /></div><div><small>RELAY</small><strong>КАБИНЕТ АГЕНТА</strong></div></div><button ref={closeRef} type="button" aria-label="Закрыть меню" onClick={closeMenu}>×</button></header>
      <nav aria-label="Мобильная навигация агента">
        {items.map(([suffix, label, hint, icon]) => <Link key={suffix} className={isActive(suffix) ? "active" : undefined} href={hrefFor(suffix)} aria-current={isActive(suffix) ? "page" : undefined} onClick={() => setOpen(false)}><i aria-hidden="true">{icon}</i><span><strong>{label}</strong><small>{hint}</small></span><b aria-hidden="true">→</b></Link>)}
      </nav>
      <footer className="mobile-telegram-footer"><a href="https://t.me/relayagents" target="_blank" rel="noreferrer"><i>↗</i><span><strong>Relay Agents</strong><small>Telegram-канал для всех агентов</small></span><b>Открыть</b></a></footer>
    </aside>
  </>;
}
