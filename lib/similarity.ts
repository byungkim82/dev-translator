export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dotProduct / (magA * magB);
}

export interface TranslationWithEmbedding {
  id: string;
  korean_text: string;
  english_text: string;
  embedding: string | null;
  model: string;
  style: string;
  category: string | null;
  is_favorite: number;
  created_at: string;
}

export interface SimilarResult extends TranslationWithEmbedding {
  similarity: number;
}

export function findSimilarTranslations(
  queryEmbedding: number[],
  translations: TranslationWithEmbedding[],
  threshold: number = 0.85,
  limit: number = 3
): SimilarResult[] {
  const withSimilarity: SimilarResult[] = [];

  for (const t of translations) {
    if (!t.embedding) continue;

    try {
      const embedding = JSON.parse(t.embedding) as number[];
      const similarity = cosineSimilarity(queryEmbedding, embedding);

      if (similarity > threshold) {
        withSimilarity.push({
          ...t,
          similarity,
        });
      }
    } catch {
      // Skip invalid embeddings
      continue;
    }
  }

  return withSimilarity
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
