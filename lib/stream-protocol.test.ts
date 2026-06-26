import { describe, expect, it } from "vitest";
import {
  applyStreamEvent,
  createNdjsonParser,
  encodeStreamEvent,
  initialStreamState,
  type StreamEvent,
} from "./stream-protocol";

describe("encodeStreamEvent", () => {
  it("serializes an event as a JSON line terminated by a newline", () => {
    const line = encodeStreamEvent({ type: "delta", text: "hi" });
    expect(line).toBe('{"type":"delta","text":"hi"}\n');
  });

  it("round-trips through the parser", () => {
    const event: StreamEvent = {
      type: "done",
      id: "t1",
      english_text: "Hello",
      truncated: false,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const parsed = createNdjsonParser().push(encodeStreamEvent(event));
    expect(parsed).toEqual([event]);
  });
});

describe("createNdjsonParser", () => {
  it("parses multiple events delivered in one chunk", () => {
    const p = createNdjsonParser();
    const events = p.push(
      encodeStreamEvent({ type: "meta", model: "m", style: "s", korean_text: "k" }) +
        encodeStreamEvent({ type: "delta", text: "a" })
    );
    expect(events.map((e) => e.type)).toEqual(["meta", "delta"]);
  });

  it("buffers a line split across pushes until its newline arrives", () => {
    const p = createNdjsonParser();
    expect(p.push('{"type":"delta","te')).toEqual([]);
    expect(p.push('xt":"split"}\n')).toEqual([{ type: "delta", text: "split" }]);
  });

  it("skips a malformed line without aborting", () => {
    const p = createNdjsonParser();
    const events = p.push('not json\n' + encodeStreamEvent({ type: "delta", text: "ok" }));
    expect(events).toEqual([{ type: "delta", text: "ok" }]);
  });
});

describe("applyStreamEvent", () => {
  it("accumulates delta text across events", () => {
    let s = initialStreamState();
    s = applyStreamEvent(s, { type: "delta", text: "Hello" });
    s = applyStreamEvent(s, { type: "delta", text: " world" });
    expect(s.text).toBe("Hello world");
  });

  it("stores meta", () => {
    const s = applyStreamEvent(initialStreamState(), {
      type: "meta",
      model: "gemini-flash-lite",
      style: "casual-work",
      korean_text: "안녕",
    });
    expect(s.meta?.model).toBe("gemini-flash-lite");
  });

  it("on done, records the footer and replaces text with the cleaned english_text", () => {
    let s = initialStreamState();
    s = applyStreamEvent(s, { type: "delta", text: '"Hello' }); // raw, with stray quote
    s = applyStreamEvent(s, {
      type: "done",
      id: "t1",
      english_text: "Hello",
      truncated: true,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(s.text).toBe("Hello");
    expect(s.done?.truncated).toBe(true);
    expect(s.done?.id).toBe("t1");
  });

  it("records an error message", () => {
    const s = applyStreamEvent(initialStreamState(), { type: "error", message: "boom" });
    expect(s.error).toBe("boom");
  });
});
