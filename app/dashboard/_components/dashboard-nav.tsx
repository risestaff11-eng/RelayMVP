"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";

const items = [
  { href: "/dashboard", label: "Рабочий стол", shortLabel: "Главная", icon: "⌂", exact: true },
  { href: "/dashboard/programs", label: "Кампании", shortLabel: "Кампании", icon: "◇" },
  { href: "/dashboard/submissions", label: "Результаты", shortLabel: "Результаты", icon: "↗" },
  { href: "/dashboard/partners", label: "Агенты", shortLabel: "Агенты", icon: "○" },
  { href: "/dashboard/rewards", label: "Выплаты", shortLabel: "Выплаты", icon: "₸" },
  { href: "/dashboard/analytics", label: "Аналитика", shortLabel: "Аналитика", icon: "⌁" },
] as const;

const primaryMobileItems = items.slice(0, 4);
const secondaryMobileItems = [
  ...items.slice(4),
  { href: "/dashboard/company-profile", label: "Профиль компании", shortLabel: "Профиль", icon: "✦", exact: false },
  { href: "/dashboard/settings", label: "Настройки", shortLabel: "Настройки", icon: "⚙", exact: false },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (item: { href: string; exact?: boolean }) => item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const secondaryActive = secondaryMobileItems.some(isActive);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [moreOpen]);

  return (
    <>
      <nav className="sidebar-nav" aria-label="Навигация кабинета компании">
        {items.map((item) => {
          const active = isActive(item);
          return <Link key={item.href} data-tour={item.exact ? "overview" : item.href.split("/").pop()} className={active ? "active" : undefined} href={item.href} aria-current={active ? "page" : undefined}><i>{item.icon}</i>{item.label}</Link>;
        })}
      </nav>

      <nav className="company-mobile-nav" aria-label="Основная навигация компании">
        {primaryMobileItems.map((item) => {
          const active = isActive(item);
          return <Link key={item.href} className={active ? "active" : undefined} href={item.href} aria-current={active ? "page" : undefined}><i>{item.icon}</i><span>{item.shortLabel}</span></Link>;
        })}
        <button className={secondaryActive || moreOpen ? "active" : undefined} type="button" aria-expanded={moreOpen} aria-controls="company-mobile-more" onClick={() => setMoreOpen((value) => !value)}><i>•••</i><span>Ещё</span></button>
      </nav>

      {moreOpen && <button className="mobile-nav-scrim" type="button" aria-label="Закрыть меню" onClick={() => setMoreOpen(false)} />}
      <section className={`mobile-more-sheet company-more-sheet ${moreOpen ? "open" : ""}`} id="company-mobile-more" aria-hidden={!moreOpen}>
        <div className="mobile-sheet-handle" />
        <div className="mobile-sheet-heading"><div><small>УПРАВЛЕНИЕ</small><strong>Другие разделы</strong></div><button type="button" aria-label="Закрыть меню" onClick={() => setMoreOpen(false)}>×</button></div>
        <div className="mobile-sheet-links">
          {secondaryMobileItems.map((item) => <Link key={item.href} className={isActive(item) ? "active" : undefined} href={item.href} onClick={() => setMoreOpen(false)}><i>{item.icon}</i><span><strong>{item.label}</strong><small>{item.href.includes("rewards") ? "Начисления и статусы выплат" : item.href.includes("analytics") ? "Сравнение эффективности агентов" : item.href.includes("profile") ? "Данные для создания заданий" : "Аккаунт, тариф и токены"}</small></span><b>→</b></Link>)}
        </div>
      </section>
    </>
  );
}
