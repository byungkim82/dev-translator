import { createSseParser, extractDelta } from "./sse";

const GEMINI_MODELS = {
  // Stable values shown to users are kept as keys (stored in DB); only the
  // underlying API model is upgraded to the current GA models (June 2026).
  "gemini-flash-lite": "gemini-3.1-flash-lite", // default: fast, cheap, GA
  "gemini-3-flash": "gemini-3.5-flash", // premium: highest quality, GA
} as const;

type GeminiModelKey = keyof typeof GEMINI_MODELS;

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason?: string;
  }>;
}

export interface GeminiResult {
  text: string;
  // True when Gemini stopped because it hit maxOutputTokens (output may be cut off).
  truncated: boolean;
}

// Gemini reports hitting the output-token cap with this finishReason.
export function isTruncated(finishReason?: string): boolean {
  return finishReason === "MAX_TOKENS";
}

const STYLE_TEMPERATURES: Record<string, number> = {
  "technical-doc": 0.1,
  "formal-work": 0.2,
  "casual-work": 0.3,
  "very-casual": 0.4,
  // F11: EN→KO reading mode. A dedicated key (not overloading a style key) so its
  // temperature is tuned independently. 0.3 favors natural readable Korean, which
  // fits the reading prompt's "natural, not stiff" goal (faithfulness comes from
  // the prompt instruction, not from suppressing temperature).
  reading: 0.3,
};

export async function callGemini(
  prompt: string,
  apiKey: string,
  model: string = "gemini-flash-lite",
  style: string = "casual-work"
): Promise<GeminiResult> {
  // Map user-facing model name to API model name, with fallback
  const modelName = GEMINI_MODELS[model as GeminiModelKey] || GEMINI_MODELS["gemini-flash-lite"];
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  const temperature = STYLE_TEMPERATURES[style] ?? 0.3;

  const response = await fetch(`${apiUrl}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 401) {
      throw new Error("API 키가 유효하지 않습니다");
    } else if (response.status === 429) {
      throw new Error("API 호출 한도를 초과했습니다");
    }
    throw new Error(`Gemini API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const candidate = data.candidates[0];
  const raw = candidate.content.parts[0].text;

  return {
    text: cleanGeminiOutput(raw),
    truncated: isTruncated(candidate.finishReason),
  };
}

// Post-process: remove surrounding quotes and common prefixes Gemini sometimes adds.
// Exported so the cleanup rules can be unit-tested without hitting the API.
export function cleanGeminiOutput(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]|["'`]$/g, "")
    .replace(/^(Translation|English|Output|Result):?\s*/i, "")
    .trim();
}

export interface GeminiStreamResult {
  truncated: boolean;
}

// Streaming counterpart of callGemini, using streamGenerateContent?alt=sse.
// Yields RAW text deltas (clean the accumulated full text with cleanGeminiOutput
// afterwards); the async-generator RETURN value carries { truncated }. fetchImpl
// is injectable so SSE handling can be unit-tested without a network call.
export async function* streamGeminiText(
  prompt: string,
  apiKey: string,
  model: string = "gemini-flash-lite",
  style: string = "casual-work",
  fetchImpl: typeof fetch = fetch
): AsyncGenerator<string, GeminiStreamResult, unknown> {
  const modelName = GEMINI_MODELS[model as GeminiModelKey] || GEMINI_MODELS["gemini-flash-lite"];
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent`;
  const temperature = STYLE_TEMPERATURES[style] ?? 0.3;

  const response = await fetchImpl(`${apiUrl}?alt=sse&key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok || !response.body) {
    if (response.status === 401) throw new Error("API 키가 유효하지 않습니다");
    if (response.status === 429) throw new Error("API 호출 한도를 초과했습니다");
    const error = response.ok ? "empty response body" : await response.text();
    throw new Error(`Gemini API error (${response.status}): ${error}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  let finishReason: string | undefined;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    for (const chunk of parser.push(decoder.decode(value, { stream: true }))) {
      const delta = extractDelta(chunk);
      if (delta.text) yield delta.text;
      if (delta.finishReason) finishReason = delta.finishReason;
    }
  }

  return { truncated: isTruncated(finishReason) };
}
