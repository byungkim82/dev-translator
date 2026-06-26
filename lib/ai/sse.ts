// Split-chunk-safe parser for Gemini's `streamGenerateContent?alt=sse` output.
// Network reads do NOT align to SSE event boundaries — a read may contain half a
// `data:` line, or several events. We buffer text and only parse a `data:` line
// once its terminating newline has arrived, so a JSON fragment is never parsed.

export interface SseParser {
  // Push a decoded text chunk; returns the JSON objects from any completed
  // `data:` lines. Incomplete trailing data stays buffered for the next push.
  push(chunk: string): unknown[];
}

export function createSseParser(): SseParser {
  let buf = "";
  return {
    push(chunk: string): unknown[] {
      buf += chunk;
      const out: unknown[] = [];
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim(); // trim() also drops a trailing \r
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue; // skip blank lines, comments, event:
        const json = line.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        try {
          out.push(JSON.parse(json));
        } catch {
          // Only complete lines reach here, so this should not happen; ignore.
        }
      }
      return out;
    },
  };
}

export interface GeminiDelta {
  text?: string;
  finishReason?: string;
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}

// Pull the text delta and finishReason out of one parsed Gemini chunk. A chunk
// may carry a finishReason (e.g. MAX_TOKENS) with no text, so both are optional.
export function extractDelta(chunk: unknown): GeminiDelta {
  const cand = (chunk as GeminiStreamChunk | null | undefined)?.candidates?.[0];
  return {
    text: cand?.content?.parts?.[0]?.text,
    finishReason: cand?.finishReason,
  };
}
