// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReadingHistoryPage from "./page";

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

const ENTRY = {
  id: "r1",
  source_text: "Hey, can you check this PR?",
  target_text: "이 PR 확인해줄 수 있어?",
  created_at: "2026-07-04T00:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ReadingHistoryPage (F11 follow-up)", () => {
  it("fetches and renders reading-history entries (source + target)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/api/reading-history")) {
          return jsonResponse({ entries: [ENTRY], total: 1, page: 1, limit: 20, hasMore: false });
        }
        throw new Error(`unexpected fetch: ${url}`);
      })
    );
    render(<ReadingHistoryPage />);
    await screen.findByText("이 PR 확인해줄 수 있어?");
    expect(screen.getByText("Hey, can you check this PR?")).toBeTruthy();
  });

  it("shows the empty state when there are no entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ entries: [], total: 0, page: 1, limit: 20, hasMore: false }))
    );
    render(<ReadingHistoryPage />);
    await screen.findByText("읽기 기록이 없습니다.");
  });

  it("deletes an entry (confirmed) via DELETE and removes it from the list", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") return jsonResponse({ success: true });
      return jsonResponse({ entries: [ENTRY], total: 1, page: 1, limit: 20, hasMore: false });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", () => true);
    const user = userEvent.setup();
    render(<ReadingHistoryPage />);
    await screen.findByText("이 PR 확인해줄 수 있어?");

    await user.click(screen.getByTitle("삭제"));

    // The entry disappears from the list...
    await waitFor(() => expect(screen.queryByText("이 PR 확인해줄 수 있어?")).toBeNull());
    // ...and a DELETE carrying the id was sent.
    const del = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "DELETE");
    expect(del).toBeTruthy();
    expect(JSON.parse((del![1] as RequestInit).body as string)).toEqual({ id: "r1" });
  });
});
