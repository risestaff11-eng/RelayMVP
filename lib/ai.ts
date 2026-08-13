import { env } from "cloudflare:workers";

type JsonSchema = Record<string, unknown>;

type GeminiResponse = {
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

export async function generateStructuredJson<T>({
  systemInstruction,
  prompt,
  schema,
  maxOutputTokens = 3500,
  thinkingLevel = "minimal",
}: {
  systemInstruction: string;
  prompt: string;
  schema: JsonSchema;
  maxOutputTokens?: number;
  thinkingLevel?: "minimal" | "low" | "medium" | "high";
}): Promise<StructuredAiResult<T>> {
  const runtime = env as unknown as { AI_PROVIDER?: string; GEMINI_API_KEY?: string; GEMINI_MODEL?: string };
  if (runtime.AI_PROVIDER && runtime.AI_PROVIDER !== "gemini") throw new Error("AI-провайдер настроен неверно");
  if (!runtime.GEMINI_API_KEY) throw new Error("Gemini ещё не подключён администратором");

  const model = runtime.GEMINI_MODEL || "gemini-3.6-flash";
  if (!/^[a-z0-9._-]+$/i.test(model)) throw new Error("Некорректное имя Gemini-модели");
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
      },
    }),
  });
  const result = (await response.json()) as GeminiResponse;
  if (!response.ok) throw new Error(result.error?.message || `Gemini API вернул HTTP ${response.status}`);
  if (result.promptFeedback?.blockReason) throw new Error(`Gemini заблокировал запрос: ${result.promptFeedback.blockReason}`);

  const candidate = result.candidates?.[0];
  const text = candidate?.content?.parts
    ?.filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text)
    .join("")
    .trim();
  if (!text) throw new Error(candidate?.finishMessage || `Gemini не вернул результат (${candidate?.finishReason || "без причины"})`);

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini вернул ответ, который не удалось прочитать как JSON");
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
