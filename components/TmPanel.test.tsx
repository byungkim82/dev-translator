// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TmPanel } from "@/components/TmPanel";
import type { SimilarTranslation } from "@/app/page";

function match(overrides: Partial<SimilarTranslation> = {}): SimilarTranslation {
  return {
    id: "m1",
    korean_text: "이 코드 봐줄래",
    english_text: "Can you review this?",
    model: "gemini-flash-lite",
    style: "casual-work",
    is_favorite: false,
    created_at: "2026-01-01T00:00:00.000Z",
    similarity: 0.82,
    ...overrides,
  };
}

const noop = () => {};
const empty = new Set<string>();

afterEach(cleanup);

describe("TmPanel", () => {
  it("renders nothing when there are no matches and not loading", () => {
    const { container } = render(
      <TmPanel matches={[]} selectedIds={empty} loading={false} onToggleExample={noop} onUseSimilar={noop} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows a searching indicator while loading with no matches yet", () => {
    render(
      <TmPanel matches={[]} selectedIds={empty} loading={true} onToggleExample={noop} onUseSimilar={noop} />
    );
    expect(screen.getByText("검색 중…")).toBeTruthy();
  });

  it("renders each match with its similarity percent and text", () => {
    render(
      <TmPanel matches={[match({ similarity: 0.82 })]} selectedIds={empty} loading={false} onToggleExample={noop} onUseSimilar={noop} />
    );
    expect(screen.getByText("82% 유사")).toBeTruthy();
    expect(screen.getByText("Can you review this?")).toBeTruthy();
  });

  it("offers the example checkbox only for favorited matches", () => {
    const { rerender } = render(
      <TmPanel matches={[match({ is_favorite: false })]} selectedIds={empty} loading={false} onToggleExample={noop} onUseSimilar={noop} />
    );
    expect(screen.queryByRole("checkbox")).toBeNull();

    rerender(
      <TmPanel matches={[match({ is_favorite: true })]} selectedIds={empty} loading={false} onToggleExample={noop} onUseSimilar={noop} />
    );
    expect(screen.getByRole("checkbox")).toBeTruthy();
  });

  it("calls onToggleExample with the match id when the checkbox is toggled", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <TmPanel matches={[match({ id: "fav1", is_favorite: true })]} selectedIds={empty} loading={false} onToggleExample={onToggle} onUseSimilar={noop} />
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith("fav1");
  });

  it("shows the applied-examples summary and reflects the checked state", () => {
    render(
      <TmPanel matches={[match({ id: "fav1", is_favorite: true })]} selectedIds={new Set(["fav1"])} loading={false} onToggleExample={noop} onUseSimilar={noop} />
    );
    expect(screen.getByText(/예시 1개 적용/)).toBeTruthy();
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("calls onUseSimilar when '이걸로 교체' is clicked", async () => {
    const onUse = vi.fn();
    const user = userEvent.setup();
    const m = match();
    render(
      <TmPanel matches={[m]} selectedIds={empty} loading={false} onToggleExample={noop} onUseSimilar={onUse} />
    );
    await user.click(screen.getByText("이걸로 교체"));
    expect(onUse).toHaveBeenCalledWith(m);
  });
});
