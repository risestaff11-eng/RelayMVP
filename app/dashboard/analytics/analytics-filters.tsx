"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function AnalyticsFilters({ programs, period, programId }: { programs: Array<{ id: string; name: string }>; period: string; programId: string }) {
  const router = useRouter(); const pathname = usePathname(); const search = useSearchParams();
  function update(key: string, value: string) { const params = new URLSearchParams(search.toString()); if (value) params.set(key, value); else params.delete(key); router.push(`${pathname}?${params.toString()}`); }
  return <div className="analytics-filters"><label><span>Период</span><select value={period} onChange={(event) => update("period", event.target.value)}><option value="7">7 дней</option><option value="30">30 дней</option><option value="90">90 дней</option><option value="all">Всё время</option></select></label><label><span>Программа</span><select value={programId} onChange={(event) => update("campaign", event.target.value)}><option value="">Все программы</option>{programs.map((program) => <option value={program.id} key={program.id}>{program.name}</option>)}</select></label></div>;
}
