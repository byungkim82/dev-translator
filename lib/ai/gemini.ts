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
  }>;
}

const STYLE_TEMPERATURES: Record<string, number> = {
  "technical-doc": 0.1,
  "formal-work": 0.2,
  "casual-work": 0.3,
  "very-casual": 0.4,
};

export async function callGemini(
  prompt: string,
  apiKey: string,
  model: string = "gemini-flash-lite",
  style: string = "casual-work"
): Promise<string> {
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
        maxOutputTokens: 2048,
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
  const raw = data.candidates[0].content.parts[0].text;

  return cleanGeminiOutput(raw);
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
