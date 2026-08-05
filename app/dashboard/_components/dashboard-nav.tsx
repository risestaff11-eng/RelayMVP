"use client";

import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Обзор", icon: "⌂", exact: true },
  { href: "/dashboard/programs", label: "Программы", icon: "◇" },
  { href: "/dashboard/submissions", label: "Результаты", icon: "↗" },
  { href: "/dashboard/partners", label: "Партнёры", icon: "○" },
  { href: "/dashboard/rewards", label: "Вознаграждения", icon: "₸" },
  { href: "/dashboard/analytics", label: "Аналитика", icon: "⌁" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav" aria-label="Навигация кабинета">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <a key={item.href} className={active ? "active" : undefined} href={item.href} aria-current={active ? "page" : undefined}>
            <i>{item.icon}</i>{item.label}
          </a>
        );
      })}
    </nav>
  );
}
