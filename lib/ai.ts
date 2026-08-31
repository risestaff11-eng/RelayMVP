import { env } from "cloudflare:workers";

type JsonSchema = Record<string, unknown>;

type AiProviderResponse = {
  candidates?: Array<{
    finishReason?: string;
    finishMessage?: string;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
  error?: { message?: string; status?: string };
};

export type StructuredAiResult<T> = {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  thoughtsTokens: number;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}

export async function generateStructuredJsonFromAudio<T>({
  systemInstruction,
  prompt,
  audio,
  mimeType,
  schema,
  maxOutputTokens = 2200,
}: {
  systemInstruction: string;
  prompt: string;
  audio: Uint8Array;
  mimeType: string;
  schema: JsonSchema;
  maxOutputTokens?: number;
}): Promise<StructuredAiResult<T>> {
  const runtime = env as unknown as { AI_PROVIDER?: string; GEMINI_API_KEY?: string; GEMINI_MODEL?: string; GEMINI_AUDIO_MODEL?: string };
  if (runtime.AI_PROVIDER && runtime.AI_PROVIDER !== "gemini") throw new Error("AI-провайдер настроен неверно");
  if (!runtime.GEMINI_API_KEY) throw new Error("Голосовая расшифровка ещё не подключена администратором");
  const model = runtime.GEMINI_AUDIO_MODEL || runtime.GEMINI_MODEL || "gemini-3.6-flash";
  if (!/^[a-z0-9._-]+$/i.test(model)) throw new Error("Некорректная настройка AI-модели Yaler");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(60000),
    headers: { "content-type": "application/json", "x-goog-api-key": runtime.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType, data: bytesToBase64(audio) } }] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, maxOutputTokens, thinkingConfig: { thinkingLevel: "minimal" } },
    }),
  });
  const result = (await response.json()) as AiProviderResponse;
  if (!response.ok) throw new Error(result.error?.message || `Yaler временно недоступен (HTTP ${response.status})`);
  const candidate = result.candidates?.[0];
  const text = candidate?.content?.parts?.filter((part) => !part.thought && typeof part.text === "string").map((part) => part.text).join("").trim();
  if (!text) throw new Error(candidate?.finishMessage || "Yaler не смог расшифровать запись");
  let data: T;
  try { data = JSON.parse(text) as T; }
  catch { throw new Error("Yaler подготовил расшифровку в неверном формате. Повторите запись"); }
  const inputTokens = result.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
  return { data, model: result.modelVersion || model, inputTokens, outputTokens, totalTokens: result.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens, thoughtsTokens: result.usageMetadata?.thoughtsTokenCount ?? 0 };
}

export async function generateStructuredJson<T>({
  systemInstruction,
  prompt,
  schema,
  maxOutputTokens = 3500,
  thinkingLevel = "minimal",
  temperature,
}: {
  systemInstruction: string;
  prompt: string;
  schema: JsonSchema;
  maxOutputTokens?: number;
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
  temperature?: number;
}): Promise<StructuredAiResult<T>> {
  const runtime = env as unknown as { AI_PROVIDER?: string; GEMINI_API_KEY?: string; GEMINI_MODEL?: string };
  if (runtime.AI_PROVIDER && runtime.AI_PROVIDER !== "gemini") throw new Error("AI-провайдер настроен неверно");
  if (!runtime.GEMINI_API_KEY) throw new Error("Yaler ещё не подключён администратором");

  const model = runtime.GEMINI_MODEL || "gemini-3.6-flash";
  if (!/^[a-z0-9._-]+$/i.test(model)) throw new Error("Некорректная настройка AI-модели Yaler");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(60000),
    headers: { "content-type": "application/json", "x-goog-api-key": runtime.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        maxOutputTokens,
        thinkingConfig: { thinkingLevel },
        ...(typeof temperature === "number" ? { temperature: Math.max(0, Math.min(1, temperature)) } : {}),
      },
    }),
  });
  const result = (await response.json()) as AiProviderResponse;
  if (!response.ok) throw new Error(result.error?.message || `Yaler временно недоступен (HTTP ${response.status})`);
  if (result.promptFeedback?.blockReason) throw new Error(`Yaler не может обработать запрос: ${result.promptFeedback.blockReason}`);

  const candidate = result.candidates?.[0];
  const text = candidate?.content?.parts
    ?.filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text)
    .join("")
    .trim();
  if (!text) throw new Error(candidate?.finishMessage || `Yaler не подготовил ответ (${candidate?.finishReason || "без причины"})`);

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error("Yaler подготовил ответ в неверном формате. Повторите запрос");
  }

  const inputTokens = result.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
  return {
    data,
    model: result.modelVersion || model,
    inputTokens,
    outputTokens,
    totalTokens: result.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens,
    thoughtsTokens: result.usageMetadata?.thoughtsTokenCount ?? 0,
  };
}
