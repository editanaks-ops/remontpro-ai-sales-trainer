import type { Request } from "express";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function callOpenRouter(
  messages: ChatMessage[],
  req?: Request
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const body = {
    model,
    messages,
    max_tokens: 8192,
    response_format: { type: "json_object" },
  };

  let response: Response;
  try {
    response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://remontpro.replit.app",
        "X-Title": "РемонтPRO AI-тренер",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error("OpenRouter недоступен. Проверьте подключение к интернету.");
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenRouter error ${response.status}: ${text}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (data.error) {
    throw new Error(`OpenRouter API error: ${data.error.message}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Пустой ответ от OpenRouter");
  }

  return content;
}

export function extractJson(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks or surrounding text
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
      text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        // fall through
      }
    }
    throw new Error("Не удалось разобрать JSON из ответа AI");
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
          "Ты прислал некорректный JSON. Верни ТОЛЬКО корректный JSON без каких-либо пояснений, markdown-блоков или другого текста.",
      },
    ];
    const retryText = await callOpenRouter(retryMessages, req);
    return extractJson(retryText);
  }
}
