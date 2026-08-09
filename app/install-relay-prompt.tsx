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
  const [manualText, setManualText] = useState("");
  const agentCabinet = pathname.startsWith("/partner/");

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const installed = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    if (!agentCabinet || installed || !mobile) return;

    let nativePrompt: InstallEvent | null = null;
    const onPrompt = (nativeEvent: Event) => {
      nativeEvent.preventDefault();
      nativePrompt = nativeEvent as InstallEvent;
      setEvent(nativePrompt);
      setManualText("");
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const fallback = window.setTimeout(() => {
      if (nativePrompt) return;
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      setManualText(isIos ? "Нажмите «Поделиться», затем «На экран Домой»." : "Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран»." );
      setVisible(true);
    }, 1800);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); window.clearTimeout(fallback); };
  }, [agentCabinet]);

  if (!agentCabinet || !visible) return null;

  const install = async () => {
    if (!event) { setVisible(false); return; }
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setEvent(null);
  };

  return <aside className="relay-install-prompt" role="dialog" aria-label="Установить Relay на устройство"><div className="relay-install-icon">R</div><div><strong>Добавьте Relay на главный экран</strong><p>{manualText || "Нажмите кнопку — Android установит Relay и будет открывать кабинет как приложение."}</p></div><button className="relay-install-action" type="button" onClick={install}>{event ? "Установить Relay" : "Понятно"}</button><button className="relay-install-close" type="button" aria-label="Закрыть" onClick={() => setVisible(false)}>×</button></aside>;
}
