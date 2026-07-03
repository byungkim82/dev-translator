// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TranslationResult } from "@/components/TranslationResult";
import type { Translation } from "@/app/page";

function tr(overrides: Partial<Translation> = {}): Translation {
  return {
    id: "t1",
    korean_text: "이거 확인해줄래?",
    english_text: "Could you take a look?",
    model: "gemini-flash-lite",
    style: "casual-work",
    is_favorite: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const noop = () => {};

afterEach(cleanup);

describe("TranslationResult direction-aware (F11)", () => {
  it("renders the English result for ko-en", () => {
    render(<TranslationResult translation={tr({ direction: "ko-en" })} onCopy={noop} onToggleFavorite={noop} />);
    expect(screen.getByText("영어 결과")).toBeTruthy();
    expect(screen.getByText("Could you take a look?")).toBeTruthy();
  });

  it("renders the English result for undefined direction (backward compatible)", () => {
    render(<TranslationResult translation={tr()} onCopy={noop} onToggleFavorite={noop} />);
    expect(screen.getByText("영어 결과")).toBeTruthy();
    expect(screen.getByText("Could you take a look?")).toBeTruthy();
  });

  it("renders the Korean result for en-ko reading mode", () => {
    render(<TranslationResult translation={tr({ direction: "en-ko", id: "" })} onCopy={noop} onToggleFavorite={noop} />);
    expect(screen.getByText("한국어 결과")).toBeTruthy();
    expect(screen.getByText("이거 확인해줄래?")).toBeTruthy();
  });

  it("disables favorite for an ephemeral reading result (no id)", () => {
    render(<TranslationResult translation={tr({ direction: "en-ko", id: "" })} onCopy={noop} onToggleFavorite={noop} />);
    expect((screen.getByText("즐겨찾기") as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables favorite for a persisted ko-en result", () => {
    render(<TranslationResult translation={tr({ direction: "ko-en", id: "t1" })} onCopy={noop} onToggleFavorite={noop} />);
    expect((screen.getByText("즐겨찾기") as HTMLButtonElement).disabled).toBe(false);
  });

  it("copies the direction-appropriate output text (Korean in reading mode)", async () => {
    const onCopy = vi.fn();
    const user = userEvent.setup();
    render(<TranslationResult translation={tr({ direction: "en-ko", id: "" })} onCopy={onCopy} onToggleFavorite={noop} />);
    await user.click(screen.getByText("복사"));
    expect(onCopy).toHaveBeenCalledWith("이거 확인해줄래?");
  });
});
