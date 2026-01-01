const GEMINI_MODELS = {
  "gemini-flash-lite": "gemini-2.5-flash-lite",
  "gemini-3-flash": "gemini-3-flash-preview",
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

export async function callGemini(
  prompt: string,
  apiKey: string,
  model: string = "gemini-flash-lite"
): Promise<string> {
  // Map user-facing model name to API model name, with fallback
  const modelName = GEMINI_MODELS[model as GeminiModelKey] || GEMINI_MODELS["gemini-flash-lite"];
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

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
        temperature: 0.1,
        maxOutputTokens: 1024,
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
  return data.candidates[0].content.parts[0].text.trim();
}
