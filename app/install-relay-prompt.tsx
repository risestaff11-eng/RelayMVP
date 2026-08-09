"use client";

import { useEffect, useState } from "react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window { __relayInstallPrompt?: InstallEvent; }
}

const SESSION_PROMPT_KEY = "relay-install-prompt-shown-v2";
const INSTALLED_KEY = "relay-app-installed";

export function InstallRelayPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const alreadyInstalled = localStorage.getItem(INSTALLED_KEY) === "true";
    const shownThisSession = sessionStorage.getItem(SESSION_PROMPT_KEY) === "true";
    if (!mobile || standalone || alreadyInstalled || shownThisSession) return;

    const offerInstall = (event?: InstallEvent) => {
      if (!event || sessionStorage.getItem(SESSION_PROMPT_KEY) === "true") return;
      sessionStorage.setItem(SESSION_PROMPT_KEY, "true");
      setInstallEvent(event);
    };
    const onReady = () => offerInstall(window.__relayInstallPrompt);
    const onPrompt = (nativeEvent: Event) => {
      nativeEvent.preventDefault();
      window.__relayInstallPrompt = nativeEvent as InstallEvent;
      offerInstall(window.__relayInstallPrompt);
    };
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "true");
      delete window.__relayInstallPrompt;
      setInstallEvent(null);
    };

    offerInstall(window.__relayInstallPrompt);
    window.addEventListener("relayinstallready", onReady);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("relayinstallready", onReady);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!installEvent) return null;

  const install = async () => {
    const currentEvent = installEvent;
    setInstallEvent(null);
    await currentEvent.prompt();
    const choice = await currentEvent.userChoice;
    delete window.__relayInstallPrompt;
    if (choice.outcome === "accepted") localStorage.setItem(INSTALLED_KEY, "true");
  };

  return (
    <aside className="relay-install-prompt" role="dialog" aria-modal="true" aria-label="Установить приложение Relay">
      <div className="relay-install-icon" aria-hidden="true"><i /><i /><i /><i /></div>
      <div><strong>Установить Relay на телефон?</strong><p>Кабинет агента будет открываться с главного экрана как приложение.</p></div>
      <button className="relay-install-action" type="button" onClick={install}>Установить</button>
      <button className="relay-install-close" type="button" aria-label="Закрыть" onClick={() => setInstallEvent(null)}>×</button>
    </aside>
  );
}
