// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "./page";

// Minimal stand-in for a JSON fetch Response (cache-hit / error path). The client
// now branches on content-type, so the fake must expose headers.get.
function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "application/json" : null) },
  } as unknown as Response;
}

// A streamed NDJSON Response, to exercise the W7 client consumption path.
function ndjsonResponse(events: object[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      for (const e of events) {
        c.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        await new Promise((r) => setTimeout(r, 0)); // async boundary between events
      }
      c.close();
    },
  });
  return {
    ok: true,
    body,
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "application/x-ndjson" : null) },
  } as unknown as Response;
}

const TRANSLATION = {
  id: "t1",
  korean_text: "확인 부탁해",
  english_text: "Could you take a look?",
  model: "gemini-flash-lite",
  style: "casual-work",
  category: null,
  is_favorite: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

// Routes the three endpoints the page hits; `autoCopy` drives the settings response.
function mockFetch(autoCopy: number) {
  return vi.fn(async (url: string) => {
    if (url === "/api/settings") {
      return jsonResponse({
        settings: {
          default_model: "gemini-flash-lite",
          default_style: "casual-work",
          auto_copy: autoCopy,
        },
      });
    }
    if (url === "/api/similar") return jsonResponse({ similar: [] });
    if (url === "/api/translate") return jsonResponse(TRANSLATION);
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const SIMILAR = {
  id: "s1",
  korean_text: "이 코드 봐줄 수 있어?",
  english_text: "Can you take a look at this code?",
  model: "gemini-flash-lite",
  style: "casual-work",
  category: null,
  is_favorite: false,
  created_at: "2026-01-01T00:00:00.000Z",
  similarity: 0.9,
};

// Like mockFetch but /api/similar returns a match, to exercise the W6 suggestion.
function mockFetchSimilar() {
  return vi.fn(async (url: string) => {
    if (url === "/api/settings") {
      return jsonResponse({
        settings: {
          default_model: "gemini-flash-lite",
          default_style: "casual-work",
          auto_copy: 0,
        },
      });
    }
    if (url === "/api/similar") return jsonResponse({ similar: [SIMILAR] });
    if (url === "/api/translate") return jsonResponse(TRANSLATION);
    throw new Error(`unexpected fetch: ${url}`);
  });
}

const writeText = vi.fn().mockResolvedValue(undefined);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  writeText.mockClear();
});

async function renderAndTranslate() {
  const user = userEvent.setup();
  // userEvent.setup() installs its own clipboard stub on navigator.clipboard,
  // so override it with our spy AFTER setup to assert on writeText.
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  render(<HomePage />);
  // Wait until settings (incl. auto_copy) have been fetched on mount.
  await waitFor(() =>
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/settings")
  );
  await user.type(screen.getByPlaceholderText(/번역할 텍스트/), "확인 부탁해");
  await user.keyboard("{Enter}");
}

describe("HomePage auto-copy (B1 + W8)", () => {
  it("auto-copies the result to the clipboard when auto_copy is enabled", async () => {
    vi.stubGlobal("fetch", mockFetch(1));

    await renderAndTranslate();

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Could you take a look?")
    );
  });

  it("does not auto-copy when auto_copy is disabled", async () => {
    vi.stubGlobal("fetch", mockFetch(0));

    await renderAndTranslate();

    // Result is rendered, but the clipboard was never written to.
    await screen.findByText("Could you take a look?");
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("HomePage similar suggestions (W6)", () => {
  async function setup() {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<HomePage />);
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/settings")
    );
    await user.type(screen.getByPlaceholderText(/번역할 텍스트/), "이 코드 봐줄래");
    await user.keyboard("{Enter}");
    return user;
  }

  it("translates immediately and offers similar past translations (no blocking modal)", async () => {
    vi.stubGlobal("fetch", mockFetchSimilar());

    await setup();

    // Fresh translation appears right away...
    await screen.findByText("Could you take a look?");
    // ...and the similar past translation is surfaced as a non-blocking suggestion.
    await screen.findByText("Can you take a look at this code?");
    await screen.findByText("이걸로 교체");
  });

  it("reuses a similar translation when '이걸로 교체' is clicked", async () => {
    vi.stubGlobal("fetch", mockFetchSimilar());

    const user = await setup();
    await screen.findByText("Could you take a look?");

    await user.click(await screen.findByText("이걸로 교체"));

    // The result is replaced by the reused translation — the fresh result text is gone.
    await waitFor(() =>
      expect(screen.queryByText("Could you take a look?")).toBeNull()
    );
  });
});

describe("HomePage as-you-type TM (P16 Phase 2)", () => {
  const SIMILAR_FAV = { ...SIMILAR, id: "s1", is_favorite: true };

  function mockTm() {
    return vi.fn(async (url: string) => {
      if (url === "/api/settings") {
        return jsonResponse({
          settings: { default_model: "gemini-flash-lite", default_style: "casual-work", auto_copy: 0 },
        });
      }
      if (url === "/api/similar") return jsonResponse({ similar: [SIMILAR_FAV] });
      if (url === "/api/translate") return jsonResponse(TRANSLATION);
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  it("looks up similar translations while typing, without translating", async () => {
    const fetchMock = mockTm();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<HomePage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/settings"));

    // No Enter — the panel appears purely from typing (after the ~500ms debounce).
    await user.type(screen.getByPlaceholderText(/번역할 텍스트/), "이 코드 봐줄래");
    await screen.findByText("Can you take a look at this code?");
    expect(fetchMock.mock.calls.some((c) => c[0] === "/api/translate")).toBe(false);
  });

  it("skips the lookup for input under 3 characters", async () => {
    const fetchMock = mockTm();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<HomePage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/settings"));

    await user.type(screen.getByPlaceholderText(/번역할 텍스트/), "ab");
    await new Promise((r) => setTimeout(r, 600)); // past the debounce window
    expect(fetchMock.mock.calls.some((c) => c[0] === "/api/similar")).toBe(false);
  });

  it("sends opt-in example ids on the next translation", async () => {
    const fetchMock = mockTm();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<HomePage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/settings"));

    const textarea = screen.getByPlaceholderText(/번역할 텍스트/);
    await user.type(textarea, "이 코드 봐줄래");
    await user.keyboard("{Enter}");
    // The favorited match surfaces with an example checkbox; opt it in.
    await screen.findByText("Can you take a look at this code?");
    await user.click(screen.getByRole("checkbox"));
    // Re-translate (refocus the textarea first — the checkbox stole focus); the
    // selected id rides along in the request body.
    await user.click(textarea);
    await user.keyboard("{Enter}");

    await waitFor(() => {
      const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>;
      const translateCalls = calls.filter((c) => c[0] === "/api/translate");
      expect(translateCalls.length).toBeGreaterThanOrEqual(2);
      const init = translateCalls.at(-1)![1] as RequestInit;
      const body = JSON.parse(init.body as string);
      expect(body.exampleIds).toEqual(["s1"]);
    });
  });
});

describe("HomePage truncation warning", () => {
  it("warns when the translation was truncated at the output-token cap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/settings") {
          return jsonResponse({
            settings: {
              default_model: "gemini-flash-lite",
              default_style: "casual-work",
              auto_copy: 0,
            },
          });
        }
        if (url === "/api/similar") return jsonResponse({ similar: [] });
        if (url === "/api/translate") {
          return jsonResponse({ ...TRANSLATION, truncated: true });
        }
        throw new Error(`unexpected fetch: ${url}`);
      })
    );
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<HomePage />);
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/settings")
    );
    await user.type(screen.getByPlaceholderText(/번역할 텍스트/), "아주 긴 텍스트");
    await user.keyboard("{Enter}");

    await screen.findByText(/잘렸을 수 있습니다/);
  });
});

describe("HomePage streaming (W7)", () => {
  const STREAM = [
    { type: "meta", model: "gemini-flash-lite", style: "casual-work", korean_text: "확인 부탁해" },
    { type: "delta", text: "Could you " },
    { type: "delta", text: "take a look?" },
    {
      type: "done",
      id: "t1",
      english_text: "Could you take a look?",
      truncated: false,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];

  function mockFetchStream(events: object[], autoCopy = 0) {
    return vi.fn(async (url: string) => {
      if (url === "/api/settings") {
        return jsonResponse({
          settings: {
            default_model: "gemini-flash-lite",
            default_style: "casual-work",
            auto_copy: autoCopy,
          },
        });
      }
      if (url === "/api/similar") return jsonResponse({ similar: [] });
      if (url === "/api/translate") return ndjsonResponse(events);
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  async function translateStreaming(fetchMock: ReturnType<typeof vi.fn>) {
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<HomePage />);
    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/settings")
    );
    await user.type(screen.getByPlaceholderText(/번역할 텍스트/), "확인 부탁해");
    await user.keyboard("{Enter}");
  }

  it("renders the streamed translation accumulated from deltas", async () => {
    await translateStreaming(mockFetchStream(STREAM));
    await screen.findByText("Could you take a look?");
  });

  it("auto-copies after a streamed translation completes when enabled", async () => {
    await translateStreaming(mockFetchStream(STREAM, 1));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Could you take a look?")
    );
  });

  it("warns when a streamed translation is truncated", async () => {
    const events = [
      STREAM[0],
      STREAM[1],
      STREAM[2],
      {
        type: "done",
        id: "t1",
        english_text: "Could you take a look?",
        truncated: true,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    await translateStreaming(mockFetchStream(events));
    await screen.findByText(/잘렸을 수 있습니다/);
  });

  it("shows an error toast on an in-band stream error", async () => {
    const events = [STREAM[0], { type: "error", message: "스트림 실패" }];
    await translateStreaming(mockFetchStream(events));
    await screen.findByText("스트림 실패");
  });

  it("clears the previous translation when a new one starts (no stale text under the cursor)", async () => {
    const enc = new TextEncoder();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const secondBody = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });

    let translateCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/settings") {
          return jsonResponse({
            settings: { default_model: "gemini-flash-lite", default_style: "casual-work", auto_copy: 0 },
          });
        }
        if (url === "/api/similar") return jsonResponse({ similar: [] });
        if (url === "/api/translate") {
          translateCalls += 1;
          // First call: a cache-hit JSON so a result is on screen; second: a stream we control.
          if (translateCalls === 1) {
            return jsonResponse({ ...TRANSLATION, english_text: "First result" });
          }
          return {
            ok: true,
            body: secondBody,
            headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "application/x-ndjson" : null) },
          } as unknown as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      })
    );

    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<HomePage />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith("/api/settings"));

    const textarea = screen.getByPlaceholderText(/번역할 텍스트/);
    await user.type(textarea, "첫번째");
    await user.keyboard("{Enter}");
    await screen.findByText("First result");

    // Start a second translation; the stream hasn't emitted any delta yet.
    await user.clear(textarea);
    await user.type(textarea, "두번째");
    await user.keyboard("{Enter}");

    // The stale first result must be gone before the new text streams in.
    await waitFor(() => expect(screen.queryByText("First result")).toBeNull());

    // Now stream the second translation.
    controller.enqueue(enc.encode(JSON.stringify(STREAM[0]) + "\n"));
    controller.enqueue(enc.encode(JSON.stringify({ type: "delta", text: "Second result" }) + "\n"));
    controller.enqueue(
      enc.encode(
        JSON.stringify({
          type: "done",
          id: "2",
          english_text: "Second result",
          truncated: false,
          created_at: "2026-01-01T00:00:00.000Z",
        }) + "\n"
      )
    );
    controller.close();

    await screen.findByText("Second result");
  });
});

describe("HomePage reading mode (F11)", () => {
  const READ_STREAM = [
    { type: "meta", model: "gemini-flash-lite", style: "reading", korean_text: "" },
    { type: "delta", text: "이거 " },
    { type: "delta", text: "확인해줄래?" },
    { type: "done", id: "", english_text: "이거 확인해줄래?", truncated: false, created_at: "" },
  ];

  function mockRead() {
    return vi.fn(async (url: string) => {
      if (url === "/api/settings") {
        return jsonResponse({
          settings: { default_model: "gemini-flash-lite", default_style: "casual-work", auto_copy: 0 },
        });
      }
      if (url === "/api/read") return ndjsonResponse(READ_STREAM);
      if (url === "/api/similar") return jsonResponse({ similar: [] });
      if (url === "/api/translate") return jsonResponse(TRANSLATION);
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  async function enterReadingAndTranslate(fetchMock: ReturnType<typeof vi.fn>) {
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<HomePage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/settings"));
    await user.click(screen.getByText("영어 → 한국어"));
    await user.type(screen.getByRole("textbox"), "Can you take a look?");
    await user.keyboard("{Enter}");
    return user;
  }

  it("translates English → Korean via /api/read and shows the Korean result", async () => {
    await enterReadingAndTranslate(mockRead());
    await screen.findByText("이거 확인해줄래?");
    await screen.findByText("한국어 결과");
  });

  it("does not run the TM lookup or /api/translate in reading mode", async () => {
    const fetchMock = mockRead();
    await enterReadingAndTranslate(fetchMock);
    await screen.findByText("이거 확인해줄래?");
    expect(fetchMock.mock.calls.some((c) => c[0] === "/api/similar")).toBe(false);
    expect(fetchMock.mock.calls.some((c) => c[0] === "/api/translate")).toBe(false);
  });

  it("disables favorite for the ephemeral reading result", async () => {
    await enterReadingAndTranslate(mockRead());
    await screen.findByText("이거 확인해줄래?");
    expect((screen.getByText("즐겨찾기") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("HomePage direction toggle abort (F11)", () => {
  // ⚠️ Unlike the other controlled-stream tests, this mock MUST wire the request
  // signal to the body stream — otherwise abortRef.abort() can't kill the fake
  // stream and the test passes whether or not the fix exists (vacuous).
  it("aborts the in-flight translation when the direction is toggled (no stale-direction render)", async () => {
    const enc = new TextEncoder();
    let bodyController!: ReadableStreamDefaultController<Uint8Array>;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/settings") {
          return jsonResponse({
            settings: { default_model: "gemini-flash-lite", default_style: "casual-work", auto_copy: 0 },
          });
        }
        if (url === "/api/similar") return jsonResponse({ similar: [] });
        if (url === "/api/translate") {
          const body = new ReadableStream<Uint8Array>({
            start(c) {
              bodyController = c;
              // Emulate real fetch: aborting the request errors the body stream so
              // reader.read() rejects with AbortError.
              init?.signal?.addEventListener("abort", () => {
                try {
                  c.error(new DOMException("aborted", "AbortError"));
                } catch {
                  // already closed/errored — fine
                }
              });
            },
          });
          return {
            ok: true,
            body,
            headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "application/x-ndjson" : null) },
          } as unknown as Response;
        }
        throw new Error(`unexpected fetch: ${url}`);
      })
    );

    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<HomePage />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith("/api/settings"));

    // Start a KO→EN streaming translation and let one delta render.
    const textarea = screen.getByPlaceholderText(/번역할 텍스트/);
    await user.type(textarea, "첫번째");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(bodyController).toBeDefined());
    bodyController.enqueue(
      enc.encode(JSON.stringify({ type: "meta", model: "gemini-flash-lite", style: "casual-work", korean_text: "첫번째" }) + "\n")
    );
    bodyController.enqueue(enc.encode(JSON.stringify({ type: "delta", text: "First delta" }) + "\n"));
    await screen.findByText("First delta");
    expect(screen.getByText("영어 결과")).toBeTruthy();

    // Toggle to reading mode mid-stream — must abort the live translation.
    await user.click(screen.getByText("영어 → 한국어"));

    // Errant delta that would only render if the loop were still alive. In the
    // fixed case the stream is already errored, so enqueue throws → ignore.
    try {
      bodyController.enqueue(enc.encode(JSON.stringify({ type: "delta", text: "Should not render" }) + "\n"));
    } catch {
      // stream aborted — expected in the fixed case
    }
    await new Promise((r) => setTimeout(r, 0));

    // Discriminating assertion: the KO→EN result label must be gone. Without the
    // abort, the still-alive loop would re-render the ko-en result ("영어 결과").
    expect(screen.queryByText("영어 결과")).toBeNull();
  });
});
