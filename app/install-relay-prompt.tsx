"use client";

import { useEffect, useState } from "react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window { __relayInstallPrompt?: InstallEvent; }
}

const SESSION_PROMPT_KEY = "relay-install-prompt-shown-v3";
const INSTALLED_KEY = "relay-app-installed";

export function InstallRelayPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const mobile = window.matchMedia("(max-width: 760px)").matches;
    const alreadyInstalled = localStorage.getItem(INSTALLED_KEY) === "true";
    const shownThisSession = sessionStorage.getItem(SESSION_PROMPT_KEY) === "true";
    if (!mobile || standalone || alreadyInstalled || shownThisSession) return;

    let offered = false;
    const offerInstall = (event?: InstallEvent) => {
      if (offered) {
        if (event) setInstallEvent(event);
        return;
      }
      offered = true;
      sessionStorage.setItem(SESSION_PROMPT_KEY, "true");
      if (event) setInstallEvent(event);
      setVisible(true);
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
      setVisible(false);
    };

    window.addEventListener("relayinstallready", onReady);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const timer = window.setTimeout(() => offerInstall(window.__relayInstallPrompt), 900);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("relayinstallready", onReady);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const install = async () => {
    if (installEvent) {
      const currentEvent = installEvent;
      setVisible(false);
      await currentEvent.prompt();
      const choice = await currentEvent.userChoice;
      delete window.__relayInstallPrompt;
      if (choice.outcome === "accepted") localStorage.setItem(INSTALLED_KEY, "true");
      return;
    }

    const target = new URL(window.location.href);
    target.searchParams.set("relayInstall", "1");
    sessionStorage.removeItem(SESSION_PROMPT_KEY);
    const chromePath = `${target.host}${target.pathname}${target.search}${target.hash}`;
    window.location.href = `intent://${chromePath}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(target.toString())};end`;
  };

  return (
    <aside className="relay-install-prompt" role="dialog" aria-modal="true" aria-label="Установить приложение Relay">
      <div className="relay-install-icon" aria-hidden="true"><i /><i /><i /><i /></div>
      <div><strong>Установить Relay на телефон?</strong><p>{installEvent ? "Открывайте кабинет агента с главного экрана." : "Откройте Relay в Chrome, чтобы установить приложение."}</p></div>
      <button className="relay-install-action" type="button" onClick={install}>{installEvent ? "Установить" : "Открыть в Chrome"}</button>
      <button className="relay-install-close" type="button" aria-label="Закрыть" onClick={() => setVisible(false)}>×</button>
    </aside>
  );
}
