"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SESSION_PROMPT_KEY = "relay-install-prompt-shown";
const INSTALLED_KEY = "relay-app-installed";

export function InstallRelayPrompt() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const agentCabinet = pathname.startsWith("/partner/");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const alreadyInstalled = localStorage.getItem(INSTALLED_KEY) === "true";
    const shownThisSession = sessionStorage.getItem(SESSION_PROMPT_KEY) === "true";

    if (!agentCabinet || !mobile || standalone || alreadyInstalled || shownThisSession) {
      const reset = window.setTimeout(() => setInstallEvent(null), 0);
      return () => window.clearTimeout(reset);
    }

    const onPrompt = (nativeEvent: Event) => {
      nativeEvent.preventDefault();
      sessionStorage.setItem(SESSION_PROMPT_KEY, "true");
      setInstallEvent(nativeEvent as InstallEvent);
    };

    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "true");
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [agentCabinet]);

  if (!agentCabinet || !installEvent) return null;

  const install = async () => {
    const currentEvent = installEvent;
    setInstallEvent(null);
    await currentEvent.prompt();
    const choice = await currentEvent.userChoice;

    if (choice.outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "true");
    }
  };

  return (
    <aside className="relay-install-prompt" role="dialog" aria-modal="true" aria-label="Установить приложение Relay">
      <div className="relay-install-icon" aria-hidden="true">R</div>
      <div>
        <strong>Установите Relay</strong>
        <p>Откройте кабинет агента с главного экрана телефона — быстро и без вкладок браузера.</p>
      </div>
      <button className="relay-install-action" type="button" onClick={install}>
        Установить приложение
      </button>
      <button
        className="relay-install-close"
        type="button"
        aria-label="Закрыть"
        onClick={() => setInstallEvent(null)}
      >
        ×
      </button>
    </aside>
  );
}
