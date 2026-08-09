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
    if (!inCabinet || window.matchMedia("(display-mode: standalone)").matches || localStorage.getItem("relay-install-offered-v2")) return;

    const offer = (installEvent?: InstallEvent) => {
      if (installEvent) { setEvent(installEvent); setManual(false); }
      else setManual(true);
      localStorage.setItem("relay-install-offered-v2", "1");
      setVisible(true);
    };
    const onPrompt = (nativeEvent: Event) => {
      nativeEvent.preventDefault();
      window.setTimeout(() => offer(nativeEvent as InstallEvent), 900);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const iosFallback = isIos ? window.setTimeout(() => offer(), 1800) : undefined;
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); if (iosFallback) window.clearTimeout(iosFallback); };
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
    <div><strong>Установить Relay на главный экран</strong><p>{manual ? "На iPhone нажмите «Поделиться», затем «На экран Домой»." : "Нажмите кнопку — браузер добавит ярлык Relay и будет открывать кабинет как приложение."}</p></div>
    <button className="relay-install-action" type="button" onClick={install}>{manual ? "Понятно" : "Установить"}</button>
    <button className="relay-install-close" type="button" aria-label="Закрыть" onClick={() => setVisible(false)}>×</button>
  </aside>;
}
