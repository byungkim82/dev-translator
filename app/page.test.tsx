// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "./page";

// Minimal stand-in for a fetch Response — the page only reads `.ok` and `.json()`.
function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
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
