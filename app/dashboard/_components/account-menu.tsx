"use client";

import { useEffect, useRef, useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";

export function AccountMenu({ name, email, initials, signOutHref }: { name: string; email: string; initials: string; signOutHref: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return <div className="account-menu" ref={ref}><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span>{initials}</span><div><strong>{name}</strong><small>{email}</small></div><i>⌄</i></button>{open && <div className="account-popover"><Link href="/dashboard/settings"><span>⚙</span><div><strong>Настройки</strong><small>Профиль, тариф и AI-токены</small></div></Link><a href={signOutHref}><span>↪</span><div><strong>Выйти</strong><small>Завершить текущий сеанс</small></div></a></div>}</div>;
}
