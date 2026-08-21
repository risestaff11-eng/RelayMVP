"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInteger } from "@/lib/format-display";

type Action = { type: string; label: string; summary: string; payload: Record<string, unknown> };
type Message = { role: "user" | "assistant"; content: string; suggestions?: string[]; action?: Action; creditsSpent?: number };

const starterPrompts = ["Проверь, что мешает запустить агентскую сеть", "Предложи новую программу для лидов", "Как активировать агентов без результатов?", "Какие показатели посмотреть сегодня?"];

export function AiAssistantChat({ companyName, initialTokenBalance }: { companyName: string; initialTokenBalance: number }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: `Я AI-агент ${companyName} в Relay. Помогу собрать программу, улучшить задания, активировать агентов и разобраться в результатах. Изменения внесу только после вашего подтверждения.`, suggestions: starterPrompts }]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [applying, setApplying] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(initialTokenBalance);
  const [error, setError] = useState("");

  async function send(text = input) {
    const content = text.trim();
    if (!content || pending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next); setInput(""); setPending(true); setError("");
    try {
      const response = await fetch("/api/company/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next.map(({ role, content: message }) => ({ role, content: message })) }) });
      const data = await response.json() as { error?: string; reply?: string; suggestions?: string[]; action?: Action; tokenBalance?: number; creditsSpent?: number };
      if (!response.ok || !data.reply) throw new Error(data.error || "AI-агент не ответил");
      setMessages((current) => [...current, { role: "assistant", content: data.reply!, creditsSpent: data.creditsSpent, suggestions: data.suggestions, action: data.action?.type === "NONE" ? undefined : data.action }]);
      if (typeof data.tokenBalance === "number") setTokenBalance(data.tokenBalance);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "AI-агент временно недоступен"); } finally { setPending(false); }
  }

  async function apply(action: Action) {
    setApplying(true); setError("");
    try {
      if (action.type === "OPEN_SECTION") {
        const allowed: Record<string, string> = { results: "/dashboard/submissions", agents: "/dashboard/partners", rewards: "/dashboard/rewards", analytics: "/dashboard/analytics", programs: "/dashboard/programs", profile: "/dashboard/company-profile", settings: "/dashboard/settings", knowledge: "/dashboard/methodologist" };
        router.push(allowed[String(action.payload.section)] || "/dashboard");
        return;
      }
      if (action.type === "CREATE_PROGRAM") {
        const response = await fetch("/api/programs/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action.payload) });
        const data = await response.json() as { error?: string; programId?: string; tokenBalance?: number };
        if (!response.ok || !data.programId) throw new Error(data.error || "Не удалось создать программу");
        if (typeof data.tokenBalance === "number") setTokenBalance(data.tokenBalance);
        router.push(`/dashboard/programs/${data.programId}`);
        return;
      }
      const response = await fetch("/api/company/assistant/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error || "Не удалось применить изменение");
      setMessages((current) => [...current, { role: "assistant", content: `${data.message || "Изменение применено"} Что улучшим следующим шагом?`, suggestions: starterPrompts }]);
      router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось выполнить действие"); } finally { setApplying(false); }
  }

  return <div className="dashboard-content module-content assistant-page">
    <div className="module-heading"><div><span className="module-kicker">AI-АГЕНТ RELAY</span><h1>Развивайте агентскую сеть в диалоге</h1><p>Получайте конкретные предложения и подтверждайте изменения профиля, программ и правил прямо в чате. Обычный ответ расходует 8–120 AI-кредитов.</p></div><div className="assistant-token-balance"><small>AI-КРЕДИТЫ</small><strong>{formatInteger(tokenBalance)}</strong></div></div>
    <section className="assistant-workspace">
      <aside><button className="assistant-help-trigger" type="button" onClick={() => void send("Проведи быструю диагностику моего кабинета и предложи одно самое полезное следующее действие") }><span>✦</span><h2>Чем могу помочь</h2><ul><li>Собрать новую программу</li><li>Улучшить задания и награды</li><li>Настроить правила и выплаты</li><li>Подготовить базу знаний</li></ul><small>Нажмите, чтобы начать. AI ничего не меняет без подтверждения.</small></button></aside>
      <div className="assistant-chat"><div className="assistant-messages" aria-live="polite">{messages.map((message, index) => <article className={message.role} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? "✦" : "Вы"}</span><div><p>{message.content}</p>{typeof message.creditsSpent === "number" && <small>Списано: {message.creditsSpent} AI-кредитов</small>}{message.action && <div className="assistant-action"><small>ПРЕДЛОЖЕННОЕ ИЗМЕНЕНИЕ</small><strong>{message.action.summary}</strong><button type="button" disabled={applying} onClick={() => void apply(message.action!)}>{applying ? "Применяю…" : `${message.action.label} →`}</button></div>}{message.suggestions && <div className="assistant-suggestions">{message.suggestions.map((suggestion) => <button type="button" onClick={() => void send(suggestion)} key={suggestion}>{suggestion}</button>)}</div>}</div></article>)}{pending && <article className="assistant"><span>✦</span><div><p>Анализирую кабинет и готовлю следующий шаг…</p></div></article>}</div>{error && <div className="inline-notice error" role="alert">{error}</div>}<form onSubmit={(event) => { event.preventDefault(); void send(); }}><textarea value={input} onChange={(event) => setInput(event.target.value)} rows={3} placeholder="Например: создай программу для привлечения лидов в Казахстане" /><button type="submit" disabled={pending || !input.trim()} aria-label="Отправить сообщение">↑</button></form></div>
    </section>
  </div>;
}
