"use client";

import { useEffect, useRef } from "react";
import { translateToKazakh } from "@/lib/kazakh-translations";
import { TRANSLATED_ATTRIBUTES, translateInterfaceTree } from "@/lib/i18n-dom";

type Locale = "ru" | "kk";

function persistLocale(locale: Locale) {
  const sharedDomain = location.hostname === "risestaff.kz" || location.hostname.endsWith(".risestaff.kz") ? "; Domain=.risestaff.kz" : "";
  document.cookie = `relay_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${sharedDomain}`;
}

export function LanguageSwitcher({ locale, className = "", manageTranslation = true, compact = false }: { locale: Locale; className?: string; manageTranslation?: boolean; compact?: boolean }) {
  const applying = useRef(false);

  useEffect(() => {
    if (!manageTranslation || locale !== "kk") return;
    let scheduled = 0;
    const apply = () => {
      if (applying.current) return;
      applying.current = true;
      observer.disconnect();
      translateInterfaceTree(document.body);
      document.title = translateToKazakh(document.title);
      document.querySelectorAll<HTMLMetaElement>('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]').forEach((meta) => {
        if (meta.content) meta.content = translateToKazakh(meta.content);
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...TRANSLATED_ATTRIBUTES] });
      applying.current = false;
    };
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(scheduled);
      scheduled = requestAnimationFrame(apply);
    });
    apply();
    return () => { cancelAnimationFrame(scheduled); observer.disconnect(); };
  }, [locale, manageTranslation]);

  const choose = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    persistLocale(nextLocale);
    location.reload();
  };

  if (compact) return <button className={`relay-language-toggle ${className}`.trim()} data-no-translate type="button" onClick={() => choose(locale === "ru" ? "kk" : "ru")} aria-label={locale === "ru" ? "Қазақшаға ауысу" : "Переключить на русский"} title={locale === "ru" ? "Қазақша" : "Русский"}>{locale === "ru" ? "ҚАЗ" : "RU"}</button>;

  return <div className={`relay-language-switcher ${className}`.trim()} data-no-translate role="group" aria-label={locale === "kk" ? "Интерфейс тілі" : "Язык интерфейса"}>
    <button type="button" className={locale === "ru" ? "active" : ""} aria-pressed={locale === "ru"} onClick={() => choose("ru")}>RU</button>
    <button type="button" className={locale === "kk" ? "active" : ""} aria-pressed={locale === "kk"} onClick={() => choose("kk")}>ҚАЗ</button>
  </div>;
}
