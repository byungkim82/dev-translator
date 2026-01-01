export function generateId(): string {
  return crypto.randomUUID();
}

export function estimateTokens(text: string): number {
  // Rough estimation: ~1.3 chars per token for Korean
  return Math.ceil(text.length / 1.3);
}

export function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
