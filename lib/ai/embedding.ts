const OPENAI_EMBEDDING_URL = "https://api.openai.com/v1/embeddings";

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

export async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(OPENAI_EMBEDDING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 401) {
      throw new Error("OpenAI API 키가 유효하지 않습니다");
    } else if (response.status === 429) {
      throw new Error("OpenAI API 호출 한도를 초과했습니다");
    }
    throw new Error(`OpenAI Embedding API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as EmbeddingResponse;
  return data.data[0].embedding;
}
