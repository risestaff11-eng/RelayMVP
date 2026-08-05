"use client";

import { useState } from "react";

export function CsvExportButton({ filename, headers, label = "Экспорт CSV" }: { filename: string; headers: string[]; label?: string }) {
  const [notice, setNotice] = useState("");

  function download() {
    const csv = `\uFEFF${headers.map((header) => `"${header.replaceAll('"', '""')}"`).join(",")}\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("CSV скачан · записей пока 0");
  }

  return <div className="action-with-feedback"><button type="button" onClick={download}>{label}</button><small aria-live="polite">{notice}</small></div>;
}

export function StatusFilters({ labels }: { labels: string[] }) {
  const [active, setActive] = useState(labels[0]);
  return <div><div className="status-filter-row" role="group" aria-label="Фильтр по статусу">{labels.map((label) => <button className={active === label ? "active" : ""} type="button" onClick={() => setActive(label)} aria-pressed={active === label} key={label}>{label}</button>)}</div><small className="control-feedback" aria-live="polite">Выбран фильтр: {active} · записей 0</small></div>;
}

export function PartnerTableTools() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Все статусы");
  return <div className="partner-table-controls"><div className="table-tools"><input aria-label="Поиск партнёра" placeholder="Поиск по имени или email" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Статус партнёра" value={status} onChange={(event) => setStatus(event.target.value)}><option>Все статусы</option><option>Активные</option><option>Неактивные</option></select></div><small className="control-feedback" aria-live="polite">{query ? `По запросу «${query}» ничего не найдено` : `${status} · партнёров пока 0`}</small></div>;
}

export function DateRangeControl() {
  const [range, setRange] = useState("30");
  return <div className="date-range-control"><label><span className="sr-only">Период аналитики</span><select value={range} onChange={(event) => setRange(event.target.value)}><option value="7">Последние 7 дней</option><option value="30">Последние 30 дней</option><option value="90">Последние 90 дней</option></select></label><small aria-live="polite">Период обновлён</small></div>;
}

export function CopyProgramLink({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
    setCopied(true);
  }

  return <button className="button button-primary compact-button" type="button" onClick={copy}>{copied ? "Ссылка скопирована ✓" : "Скопировать ссылку приглашения"}<span>↗</span></button>;
}
