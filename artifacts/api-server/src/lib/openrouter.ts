import type { Request } from "express";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_API_URL = `${OPENROUTER_BASE_URL}/chat/completions`;
const DEFAULT_MODEL = "openrouter/auto";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function getStatusErrorMessage(status: number, body: string): string {
  if (status === 401) return "Недействительный API-ключ OpenRouter. Проверьте OPENROUTER_API_KEY.";
  if (status === 402) return "Недостаточно кредитов на аккаунте OpenRouter.";
  if (status === 403) return "Доступ запрещён: аккаунт OpenRouter заблокирован или нет доступа к модели.";
  if (status === 429) return "Лимит запросов OpenRouter превышен. Попробуйте ещё раз через несколько секунд.";
  if (status >= 500) return `Ошибка на стороне OpenRouter (${status}). Попробуйте позже.`;
  return `OpenRouter вернул ошибку ${status}: ${body.slice(0, 200)}`;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callOpenRouter(
  messages: ChatMessage[],
  req?: Request
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY не настроен на сервере.");
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const body = {
    model,
    messages,
    max_tokens: 2048,
  };

  const doFetch = async (): Promise<Response> => {
    try {
      return await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://remontpro.replit.app",
          "X-Title": "RemontPRO AI Trainer",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      throw new Error(`Не удалось подключиться к OpenRouter: ${cause}`);
    }
  };

  let response = await doFetch();

  // Single retry on 429 after a short delay
  if (response.status === 429) {
    await sleep(2000);
    response = await doFetch();
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(getStatusErrorMessage(response.status, text));
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error) {
    throw new Error(`OpenRouter API error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Пустой ответ от OpenRouter. Попробуйте ещё раз.");
  }

  return content;
}

export function extractJson(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Strip markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1]);
      } catch {
        // fall through
      }
    }
    // Try to grab first {...} or [...] block
    const objectMatch = text.match(/(\{[\s\S]*\})/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[1]);
      } catch {
        // fall through
      }
    }
    throw new Error("AI вернул некорректный JSON. Попробуйте ещё раз.");
  }
}

export async function callOpenRouterWithJsonRetry(
  messages: ChatMessage[],
  req?: Request
): Promise<unknown> {
  const text = await callOpenRouter(messages, req);
  try {
    return extractJson(text);
  } catch {
    // Retry with explicit JSON instruction
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: "assistant", content: text },
      {
        role: "user",
        content:
          "Ты прислал некорректный JSON. Верни ТОЛЬКО корректный JSON без каких-либо пояснений, markdown-блоков или другого текста. Начни ответ сразу с { и заверши на }.",
      },
    ];
    const retryText = await callOpenRouter(retryMessages, req);
    return extractJson(retryText);
  }
}
