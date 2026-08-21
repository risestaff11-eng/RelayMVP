"use client";

import { useEffect, useRef } from "react";
import { translateToKazakh } from "@/lib/kazakh-translations";

type Locale = "ru" | "kk";

const ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;

function translateTree(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script, style, code, pre, [data-no-translate]")) continue;
    const translated = translateToKazakh(node.data);
    if (translated !== node.data) node.data = translated;
  }

  const elements = root instanceof Element ? [root, ...root.querySelectorAll<HTMLElement>("*")] : [...root.querySelectorAll<HTMLElement>("*")];
  for (const element of elements) {
    if (element.closest("[data-no-translate]")) continue;
    for (const attribute of ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const translated = translateToKazakh(value);
      if (translated !== value) element.setAttribute(attribute, translated);
    }
  }
}

function persistLocale(locale: Locale) {
  const sharedDomain = location.hostname === "risestaff.kz" || location.hostname.endsWith(".risestaff.kz") ? "; Domain=.risestaff.kz" : "";
  document.cookie = `relay_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${sharedDomain}`;
}

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const applying = useRef(false);

  useEffect(() => {
    if (locale !== "kk") return;
    let scheduled = 0;
    const apply = () => {
      if (applying.current) return;
      applying.current = true;
      observer.disconnect();
      translateTree(document.body as unknown as ParentNode);
      document.title = translateToKazakh(document.title);
      document.querySelectorAll<HTMLMetaElement>('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]').forEach((meta) => {
        if (meta.content) meta.content = translateToKazakh(meta.content);
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRIBUTES] });
      applying.current = false;
    };
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(scheduled);
      scheduled = requestAnimationFrame(apply);
    });
    apply();
    return () => { cancelAnimationFrame(scheduled); observer.disconnect(); };
  }, [locale]);

  const choose = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    persistLocale(nextLocale);
    location.reload();
  };

  return <div className="relay-language-switcher" data-no-translate role="group" aria-label={locale === "kk" ? "Интерфейс тілі" : "Язык интерфейса"}>
    <button type="button" className={locale === "ru" ? "active" : ""} aria-pressed={locale === "ru"} onClick={() => choose("ru")}>RU</button>
    <button type="button" className={locale === "kk" ? "active" : ""} aria-pressed={locale === "kk"} onClick={() => choose("kk")}>ҚАЗ</button>
  </div>;
}
