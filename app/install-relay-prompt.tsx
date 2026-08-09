"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallRelayPrompt() {
  const pathname = usePathname();
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [manual, setManual] = useState(false);
  const inCabinet = pathname.startsWith("/dashboard") || pathname.startsWith("/partner/");

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    if (!inCabinet || window.matchMedia("(display-mode: standalone)").matches || localStorage.getItem("relay-install-offered")) return;

    const offer = (installEvent?: InstallEvent) => {
      if (installEvent) { setEvent(installEvent); setManual(false); }
      else setManual(true);
      localStorage.setItem("relay-install-offered", "1");
      setVisible(true);
    };
    const onPrompt = (nativeEvent: Event) => {
      nativeEvent.preventDefault();
      window.clearTimeout(fallback);
      window.setTimeout(() => offer(nativeEvent as InstallEvent), 900);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const fallback = window.setTimeout(() => offer(), 2400);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.clearTimeout(fallback); };
  }, [inCabinet]);

  if (!inCabinet || !visible) return null;

  const install = async () => {
    if (!event) { setVisible(false); return; }
    await event.prompt();
    await event.userChoice;
    setVisible(false);
  };

  return <aside className="relay-install-prompt" role="dialog" aria-label="Установить Relay на устройство">
    <div className="relay-install-icon">R</div>
    <div><strong>Relay всегда под рукой</strong><p>{manual ? "В меню браузера выберите «Добавить на главный экран»." : "Установите Relay на главный экран и открывайте кабинет как приложение."}</p></div>
    <button className="relay-install-action" type="button" onClick={install}>{manual ? "Понятно" : "Установить"}</button>
    <button className="relay-install-close" type="button" aria-label="Закрыть" onClick={() => setVisible(false)}>×</button>
  </aside>;
}
