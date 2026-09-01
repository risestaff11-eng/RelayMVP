"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";
import { DashboardIcon } from "./dashboard-icon";

const items = [
  { group: "РАБОТА", href: "/dashboard", label: "Рабочий стол", hint: "Сводка и следующие действия", icon: "home", exact: true },
  { group: "РАБОТА", href: "/dashboard/crm", label: "CRM", hint: "Клиенты, сделки и агенты", icon: "results" },
  { group: "РАБОТА", href: "/dashboard/rewards", label: "Выплаты", hint: "Начисления и подтверждения", icon: "rewards" },
  { group: "РАБОТА", href: "/dashboard/reports", label: "Отчёты агентов", hint: "История, KPI и сигналы", icon: "reports" },
  { group: "СЕТЬ", href: "/dashboard/programs", label: "Программы", hint: "Задания, условия и ссылки", icon: "programs" },
  { group: "СЕТЬ", href: "/dashboard/methodologist", label: "Материалы для агентов", hint: "Скрипты, ответы и обучение", icon: "methodologist" },
  { group: "КОНТРОЛЬ", href: "/dashboard/analytics", label: "Аналитика", hint: "Сравнение эффективности", icon: "analytics" },
  { group: "КОНТРОЛЬ", href: "/dashboard/agent-rating", label: "Рейтинг агентов", hint: "Сделки, деньги и конверсия", icon: "agents" },
  { group: "КОНТРОЛЬ", href: "/dashboard/notifications", label: "Уведомления", hint: "Срочные действия и история", icon: "reports" },
  { group: "НАСТРОЙКИ", href: "/dashboard/assistant", label: "RiseStaff AI", hint: "Помощник по программам", icon: "assistant" },
  { group: "НАСТРОЙКИ", href: "/dashboard/company-profile", label: "Данные компании", hint: "Основа для заданий", icon: "company" },
  { group: "НАСТРОЙКИ", href: "/dashboard/settings", label: "Настройки", hint: "Доступ, тариф и экспорт", icon: "settings" },
] as const;
const groups = ["РАБОТА", "СЕТЬ", "КОНТРОЛЬ", "НАСТРОЙКИ"] as const;

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
      {groups.map((group) => <div className="sidebar-nav-group" key={group}><small className="sidebar-nav-label">{group}</small>{items.filter((item) => item.group === group).map((item) => <Link key={item.href} data-tour={("exact" in item && item.exact) ? "overview" : item.href.split("/").pop()} className={isActive(item) ? "active" : undefined} href={item.href} aria-current={isActive(item) ? "page" : undefined}><i><DashboardIcon name={item.icon} /></i><span>{item.label}<small>{item.hint}</small></span></Link>)}</div>)}
    </nav>

    <button className="mobile-menu-trigger company-menu-trigger" type="button" aria-label="Открыть меню" aria-expanded={open} aria-controls="company-mobile-drawer" onClick={() => setOpen(true)}><i /><i /><i /></button>
    {open && <button className="mobile-drawer-scrim" type="button" aria-label="Закрыть меню" onClick={() => setOpen(false)} />}
    <aside className={`mobile-side-drawer company-side-drawer ${open ? "open" : ""}`} id="company-mobile-drawer" aria-hidden={!open} inert={!open} role="dialog" aria-modal="true" aria-label="Меню кабинета компании">
      <header><div className="mobile-drawer-brand"><span>R</span><div><small>RISESTAFF</small><strong>КАБИНЕТ КОМПАНИИ</strong></div></div><button type="button" aria-label="Закрыть меню" onClick={() => setOpen(false)}>×</button></header>
      <nav aria-label="Мобильная навигация компании">
        {groups.map((group) => <div className="mobile-nav-group" key={group}><small>{group}</small>{items.filter((item) => item.group === group).map((item) => <Link key={item.href} className={isActive(item) ? "active" : undefined} href={item.href} aria-current={isActive(item) ? "page" : undefined} onClick={() => setOpen(false)}><i><DashboardIcon name={item.icon} /></i><span><strong>{item.label}</strong><small>{item.hint}</small></span><b aria-hidden="true">→</b></Link>)}</div>)}
      </nav>
      <footer><span>RISESTAFF · АГЕНТСКИЕ ПРОДАЖИ</span><p>Все основные разделы доступны из этого меню.</p></footer>
    </aside>
  </>;
}
