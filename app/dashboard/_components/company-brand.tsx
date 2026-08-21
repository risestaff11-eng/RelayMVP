"use client";

import { useRef, useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";

function initials(value: string) { return value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "R"; }

export function CompanyBrand({ company }: { company: { id: string; name: string; logoObjectKey: string | null } }) {
  const input = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState(company.logoObjectKey ? `/api/company/logo?companyId=${company.id}` : "");
  const [notice, setNotice] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    const form = new FormData(); form.set("logo", file); setNotice("Загрузка…");
    const response = await fetch("/api/company/logo", { method: "POST", body: form });
    const data = await response.json() as { logoUrl?: string; error?: string };
    if (response.ok && data.logoUrl) { setLogo(`${data.logoUrl}&v=${Date.now()}`); setNotice("Логотип сохранён"); }
    else setNotice(data.error || "Не удалось загрузить логотип");
  }
  return <div className="company-white-label-brand-wrap"><div className="brand company-white-label-brand"><button type="button" className="company-logo-button" onClick={() => input.current?.click()} aria-label="Загрузить логотип компании">{logo ? <img src={logo} alt={`Логотип ${company.name}`} /> : <span>{initials(company.name)}</span>}<i>＋</i></button><Link href="/dashboard" aria-label={`Вернуться в кабинет ${company.name}`}><strong>{company.name}</strong><small>Рабочее пространство</small></Link></div><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files?.[0])} /><small className="company-logo-notice" aria-live="polite">{notice}</small></div>;
}

export function CompanyLogo({ company, className = "" }: { company: { id: string; name: string; logoObjectKey?: string | null }; className?: string }) {
  return <span className={`company-logo ${className}`}>{company.logoObjectKey ? <img src={`/api/company/logo?companyId=${company.id}`} alt={`Логотип ${company.name}`} /> : initials(company.name)}</span>;
}
