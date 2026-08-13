"use client";

import { useEffect, useRef, useState } from "react";
import { SafeLink as Link } from "@/app/safe-link";

export function AccountMenu({ name, email, initials, signOutHref }: { name: string; email: string; initials: string; signOutHref: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const closeWithKeyboard = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeWithKeyboard);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", closeWithKeyboard); };
  }, []);
  return <div className="account-menu" ref={ref}><button type="button" aria-haspopup="menu" aria-controls="account-menu-popover" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span>{initials}</span><div><strong>{name}</strong><small>{email}</small></div><i aria-hidden="true">⌄</i></button>{open && <div className="account-popover" id="account-menu-popover" role="menu"><Link role="menuitem" href="/dashboard/settings" onClick={() => setOpen(false)}><span aria-hidden="true">⚙</span><div><strong>Настройки</strong><small>Профиль, тариф и AI-кредиты</small></div></Link><a role="menuitem" href={signOutHref}><span aria-hidden="true">↪</span><div><strong>Выйти</strong><small>Завершить текущий сеанс</small></div></a></div>}</div>;
}
