"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";

const items = [
  { href: "/dashboard", label: "Рабочий стол", hint: "Сводка и следующие действия", icon: "⌂", exact: true },
  { href: "/dashboard/programs", label: "Программы", hint: "Задания, награды и ссылки", icon: "◇" },
  { href: "/dashboard/submissions", label: "Результаты", hint: "Проверка работы агентов", icon: "↗" },
  { href: "/dashboard/partners", label: "Агенты", hint: "Участники и управление доступом", icon: "○" },
  { href: "/dashboard/rewards", label: "Выплаты", hint: "Начисления и реестр", icon: "₸" },
  { href: "/dashboard/analytics", label: "Аналитика", hint: "Сравнение эффективности", icon: "⌁" },
  { href: "/dashboard/assistant", label: "AI-агент", hint: "Советы и изменения в сервисе", icon: "✦" },
  { href: "/dashboard/company-profile", label: "Данные компании", hint: "Основа для AI и заданий", icon: "□" },
  { href: "/dashboard/settings", label: "Настройки", hint: "Контакты, тариф и AI-кредиты", icon: "⚙" },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (item: { href: string; exact?: boolean }) => item.exact ? pathname === item.href : pathname.startsWith(item.href);

  useEffect(() => {
    document.body.classList.toggle("mobile-drawer-open", open);
    if (!open) return () => document.body.classList.remove("mobile-drawer-open");
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("keydown", close); document.body.classList.remove("mobile-drawer-open"); };
  }, [open]);

  return <>
    <nav className="sidebar-nav" aria-label="Навигация кабинета компании">
      <small className="sidebar-nav-label">УПРАВЛЕНИЕ</small>
      {items.slice(0, 6).map((item) => <Link key={item.href} data-tour={item.exact ? "overview" : item.href.split("/").pop()} className={isActive(item) ? "active" : undefined} href={item.href} aria-current={isActive(item) ? "page" : undefined}><i>{item.icon}</i><span>{item.label}<small>{item.hint}</small></span></Link>)}
      <small className="sidebar-nav-label">НАСТРОЙКА</small>
      {items.slice(6).map((item) => <Link key={item.href} className={isActive(item) ? "active" : undefined} href={item.href} aria-current={isActive(item) ? "page" : undefined}><i>{item.icon}</i><span>{item.label}<small>{item.hint}</small></span></Link>)}
    </nav>

    <button className="mobile-menu-trigger company-menu-trigger" type="button" aria-label="Открыть меню" aria-expanded={open} aria-controls="company-mobile-drawer" onClick={() => setOpen(true)}><i /><i /><i /></button>
    {open && <button className="mobile-drawer-scrim" type="button" aria-label="Закрыть меню" onClick={() => setOpen(false)} />}
    <aside className={`mobile-side-drawer company-side-drawer ${open ? "open" : ""}`} id="company-mobile-drawer" aria-hidden={!open}>
      <header><div className="mobile-drawer-brand"><span>R</span><div><small>RELAY</small><strong>КАБИНЕТ КОМПАНИИ</strong></div></div><button type="button" aria-label="Закрыть меню" onClick={() => setOpen(false)}>×</button></header>
      <nav aria-label="Мобильная навигация компании">
        {items.map((item) => <Link key={item.href} className={isActive(item) ? "active" : undefined} href={item.href} aria-current={isActive(item) ? "page" : undefined} onClick={() => setOpen(false)}><i>{item.icon}</i><span><strong>{item.label}</strong><small>{item.hint}</small></span><b>→</b></Link>)}
      </nav>
      <footer><span>RELAY · АГЕНТСКИЕ ПРОДАЖИ</span><p>Все основные разделы доступны из этого меню.</p></footer>
    </aside>
  </>;
}
