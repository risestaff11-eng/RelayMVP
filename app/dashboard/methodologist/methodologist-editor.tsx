"use client";

import { useRef, useState } from "react";
import { formatInteger } from "@/lib/format-display";

type Item = { id: string; kind: string; title: string; content: string; externalUrl: string | null; fileName: string | null; status: string };
type Draft = { kind: string; title: string; content: string };

export function MethodologistEditor({ initialItems, tokenBalance }: { initialItems: Item[]; tokenBalance: number }) {
  const [items, setItems] = useState(initialItems);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setNotice("");
    const response = await fetch("/api/company/knowledge", { method: "POST", body: new FormData(event.currentTarget) });
    const data = await response.json() as { item?: Item; error?: string };
    if (response.ok && data.item) { setItems((current) => [...current, data.item!]); formRef.current?.reset(); setNotice("Материал опубликован для агентов."); }
    else setNotice(data.error || "Не удалось сохранить материал");
    setPending(false);
  }

  async function generate() {
    setPending(true); setNotice("AI готовит практичные материалы…");
    const response = await fetch("/api/company/knowledge/generate", { method: "POST" });
    const data = await response.json() as { items?: Draft[]; error?: string };
    if (response.ok && data.items) { setDrafts(data.items); setNotice("Проверьте и отредактируйте черновики перед публикацией."); }
    else setNotice(data.error || "Не удалось создать материалы");
    setPending(false);
  }

  async function publishDrafts() {
    setPending(true); setNotice("");
    const response = await fetch("/api/company/knowledge/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: drafts }) });
    const data = await response.json() as { items?: Item[]; error?: string };
    if (response.ok && data.items) { setItems((current) => [...current, ...data.items!]); setDrafts([]); setNotice("AI-материалы подтверждены и опубликованы."); }
    else setNotice(data.error || "Не удалось опубликовать черновики");
    setPending(false);
  }

  async function remove(id: string) {
    const response = await fetch(`/api/company/knowledge?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) setItems((current) => current.filter((item) => item.id !== id));
  }

  return <div className="dashboard-content module-content methodologist-page"><div className="module-heading"><div><span className="module-kicker">AI-МЕТОДОЛОГ</span><h1>База знаний для агентов</h1><p>Скрипты, памятки, ссылки и файлы, которые помогают агенту уверенно рекомендовать вашу компанию.</p></div><div className="assistant-token-balance"><small>AI-КРЕДИТЫ</small><strong>{formatInteger(tokenBalance)}</strong></div></div><section className="methodologist-grid"><div className="panel"><div className="panel-header"><div><h2>Добавить материал</h2><p>Опубликуйте вручную или прикрепите файл до 10 МБ.</p></div></div><form ref={formRef} className="methodologist-form" onSubmit={save}><label><span>Тип</span><select name="kind" defaultValue="SCRIPT"><option value="SCRIPT">Скрипт</option><option value="GUIDE">Инструкция</option><option value="CASE">Кейс</option><option value="LINK">Ссылка</option><option value="FILE">Файл</option></select></label><label><span>Название</span><input name="title" required maxLength={120} /></label><label><span>Текст</span><textarea name="content" rows={6} placeholder="Готовая фраза, инструкция или описание материала" /></label><label><span>Внешняя ссылка</span><input name="externalUrl" type="url" placeholder="https://" /></label><label className="knowledge-file-picker"><span>Файл</span><input name="file" type="file" /></label><button className="button button-primary" disabled={pending} type="submit">Опубликовать <span>→</span></button></form></div><div className="panel ai-methodologist-panel"><div className="panel-header"><div><h2>Создать с помощью AI</h2><p>AI использует подтверждённый профиль компании и подготовит редактируемые черновики.</p></div></div><button className="button button-secondary" disabled={pending} type="button" onClick={() => void generate()}>✦ Сгенерировать базу знаний</button>{drafts.length > 0 && <div className="knowledge-drafts">{drafts.map((draft, index) => <article key={index}><select value={draft.kind} onChange={(event) => setDrafts((current) => current.map((item, i) => i === index ? { ...item, kind: event.target.value } : item))}><option value="SCRIPT">Скрипт</option><option value="GUIDE">Инструкция</option><option value="CASE">Кейс</option></select><input value={draft.title} onChange={(event) => setDrafts((current) => current.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} /><textarea rows={5} value={draft.content} onChange={(event) => setDrafts((current) => current.map((item, i) => i === index ? { ...item, content: event.target.value } : item))} /></article>)}<button className="button button-primary" disabled={pending} type="button" onClick={() => void publishDrafts()}>Подтвердить и опубликовать</button></div>}</div></section>{notice && <div className="inline-notice" role="status">{notice}</div>}<section className="panel knowledge-library"><div className="panel-header"><div><h2>Опубликовано для агентов</h2><p>{items.length} материалов видно в кабинете агента.</p></div></div>{items.length ? <div>{items.map((item) => <article key={item.id}><span>{item.kind}</span><div><strong>{item.title}</strong><p>{item.content || item.fileName || item.externalUrl}</p></div><button type="button" onClick={() => void remove(item.id)}>Удалить</button></article>)}</div> : <div className="partner-empty-state"><strong>База знаний пока пуста</strong><p>Добавьте первый скрипт или создайте набор материалов с AI.</p></div>}</section></div>;
}
