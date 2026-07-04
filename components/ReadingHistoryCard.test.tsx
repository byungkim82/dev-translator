// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadingHistoryCard, type ReadingEntry } from "@/components/ReadingHistoryCard";

function entry(overrides: Partial<ReadingEntry> = {}): ReadingEntry {
  return {
    id: "r1",
    source_text: "Hey, can you check this PR?",
    target_text: "이 PR 확인해줄 수 있어?",
    created_at: "2026-07-04T00:00:00.000Z",
    ...overrides,
  };
}

const noop = () => {};

afterEach(cleanup);

describe("ReadingHistoryCard", () => {
  it("renders the English source and Korean target", () => {
    render(<ReadingHistoryCard entry={entry()} onCopy={noop} onDelete={noop} />);
    expect(screen.getByText("Hey, can you check this PR?")).toBeTruthy();
    expect(screen.getByText("이 PR 확인해줄 수 있어?")).toBeTruthy();
  });

  it("copies the Korean output (target), not the English", async () => {
    const onCopy = vi.fn();
    const user = userEvent.setup();
    render(<ReadingHistoryCard entry={entry()} onCopy={onCopy} onDelete={noop} />);
    await user.click(screen.getByTitle("한국어 복사"));
    expect(onCopy).toHaveBeenCalledWith("이 PR 확인해줄 수 있어?");
  });

  it("calls onDelete with the id when delete is confirmed", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    vi.stubGlobal("confirm", () => true);
    render(<ReadingHistoryCard entry={entry({ id: "r9" })} onCopy={noop} onDelete={onDelete} />);
    await user.click(screen.getByTitle("삭제"));
    expect(onDelete).toHaveBeenCalledWith("r9");
    vi.unstubAllGlobals();
  });

  it("does not delete when the confirm dialog is dismissed", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    vi.stubGlobal("confirm", () => false);
    render(<ReadingHistoryCard entry={entry()} onCopy={noop} onDelete={onDelete} />);
    await user.click(screen.getByTitle("삭제"));
    expect(onDelete).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
