// NDJSON wire protocol between the streaming translate route and the browser.
// One JSON object per line: a `meta` header, then `delta` text chunks, then a
// `done` footer (or an in-band `error`). Shared by server (encode) and client
// (decode + reduce) so both ends agree on the shape and it can be unit-tested.

export interface MetaEvent {
  type: "meta";
  model: string;
  style: string;
  korean_text: string;
}

export interface DeltaEvent {
  type: "delta";
  text: string;
}

export interface DoneEvent {
  type: "done";
  id: string;
  english_text: string;
  truncated: boolean;
  created_at: string;
}

export interface ErrorEvent {
  type: "error";
  message: string;
}

export type StreamEvent = MetaEvent | DeltaEvent | DoneEvent | ErrorEvent;

// Server side: serialize one event as an NDJSON line (JSON + newline).
export function encodeStreamEvent(event: StreamEvent): string {
  return JSON.stringify(event) + "\n";
}

export interface NdjsonParser {
  // Push a decoded text chunk; returns the events from any completed lines.
  push(chunk: string): StreamEvent[];
}

// Client side: split-chunk-safe NDJSON line parser (same buffering discipline as
// the SSE parser — never parse a partial line).
export function createNdjsonParser(): NdjsonParser {
  let buf = "";
  return {
    push(chunk: string): StreamEvent[] {
      buf += chunk;
      const out: StreamEvent[] = [];
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          out.push(JSON.parse(line) as StreamEvent);
        } catch {
          // Skip a malformed line rather than aborting the whole stream.
        }
      }
      return out;
    },
  };
}

// Client side: accumulated state built up from the stream of events.
export interface StreamState {
  meta?: MetaEvent;
  text: string; // raw concatenated deltas while streaming
  done?: DoneEvent; // present once the final footer arrives
  error?: string;
}

export function initialStreamState(): StreamState {
  return { text: "" };
}

export function applyStreamEvent(state: StreamState, event: StreamEvent): StreamState {
  switch (event.type) {
    case "meta":
      return { ...state, meta: event };
    case "delta":
      return { ...state, text: state.text + event.text };
    case "done":
      // Prefer the server's cleaned english_text over the raw delta accumulation.
      return { ...state, done: event, text: event.english_text };
    case "error":
      return { ...state, error: event.message };
    default:
      return state;
  }
}
