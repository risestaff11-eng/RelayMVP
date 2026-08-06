"use client";

import { usePathname } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";

const items = [
  { href: "/dashboard", label: "Рабочий стол", icon: "⌂", exact: true },
  { href: "/dashboard/programs", label: "Кампании", icon: "◇" },
  { href: "/dashboard/submissions", label: "Результаты", icon: "↗" },
  { href: "/dashboard/partners", label: "Агенты", icon: "○" },
  { href: "/dashboard/rewards", label: "Выплаты", icon: "₸" },
  { href: "/dashboard/analytics", label: "Аналитика", icon: "⌁" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav" aria-label="Навигация кабинета">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link key={item.href} data-tour={item.exact ? "overview" : item.href.split("/").pop()} className={active ? "active" : undefined} href={item.href} aria-current={active ? "page" : undefined}>
            <i>{item.icon}</i>{item.label}
          </Link>
        );
      })}
    </nav>
  );
}
