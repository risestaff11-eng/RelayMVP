"use client";

import { usePathname } from "next/navigation";

const sections = [
  ["/dashboard/programs", "Программы и задания"],
  ["/dashboard/submissions", "Проверка результатов"],
  ["/dashboard/partners", "Кто вас рекомендует"],
  ["/dashboard/rewards", "Выплаты агентам"],
  ["/dashboard/analytics", "Аналитика"],
  ["/dashboard/assistant", "Yaler · программы"],
  ["/dashboard/methodologist", "Материалы для агентов"],
  ["/dashboard/company-profile", "Данные компании"],
  ["/dashboard/settings", "Настройки"],
] as const;

export function DashboardContext({ nextStep }: { nextStep: string }) {
  const pathname = usePathname();
  const section = sections.find(([href]) => pathname.startsWith(href))?.[1] ?? "Рабочий стол";
  return <div className="dashboard-context"><small>{section}</small><p>{nextStep}</p></div>;
}
