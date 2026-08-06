"use client";

import { usePathname } from "next/navigation";
import { SafeLink as Link } from "@/app/safe-link";

const items = [
  ["", "Главная", "⌂"],
  ["/opportunities", "Возможности", "✦"],
  ["/missions", "Мои задания", "◎"],
  ["/submissions", "Лиды и сделки", "↗"],
  ["/payouts", "Выплаты", "₸"],
  ["/materials", "Материалы", "▤"],
  ["/profile", "Профиль", "○"],
] as const;

export function PartnerNav({ token }: { token: string }) {
  const pathname = usePathname();
  const root = `/partner/${token}`;
  return <nav className="partner-nav" aria-label="Навигация агента">{items.map(([suffix, label, icon]) => { const href = `${root}${suffix}`; const active = suffix ? pathname.startsWith(href) : pathname === root; return <Link className={active ? "active" : undefined} aria-current={active ? "page" : undefined} href={href} key={suffix}><i>{icon}</i><span>{label}</span></Link>; })}</nav>;
}
