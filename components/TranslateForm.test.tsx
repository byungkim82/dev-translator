// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TranslateForm } from "@/components/TranslateForm";

afterEach(cleanup);

const noopTranslate = () => Promise.resolve();

describe("TranslateForm direction toggle (F11)", () => {
  it("renders both direction toggle buttons", () => {
    render(<TranslateForm onTranslate={noopTranslate} isLoading={false} />);
    expect(screen.getByText("한국어 → 영어")).toBeTruthy();
    expect(screen.getByText("영어 → 한국어")).toBeTruthy();
  });

  it("defaults to KO→EN: shows the style selector and the Korean input label", () => {
    render(<TranslateForm onTranslate={noopTranslate} isLoading={false} />);
    expect(screen.getByText("한국어 입력")).toBeTruthy();
    // Style options only exist in KO→EN.
    expect(screen.getByText("캐주얼 업무용")).toBeTruthy();
  });

  it("in reading mode (en-ko): hides the style selector, keeps model, shows English input label", () => {
    render(<TranslateForm onTranslate={noopTranslate} isLoading={false} direction="en-ko" />);
    expect(screen.getByText("영어 입력")).toBeTruthy();
    expect(screen.queryByText("캐주얼 업무용")).toBeNull(); // style selector gone
    expect(screen.getByText("Gemini 3.1 Flash Lite (추천)")).toBeTruthy(); // model stays
  });

  it("clicking a direction button notifies the page and clears the draft", async () => {
    const onDirectionChange = vi.fn();
    const onDraftChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TranslateForm
        onTranslate={noopTranslate}
        isLoading={false}
        direction="ko-en"
        onDirectionChange={onDirectionChange}
        onDraftChange={onDraftChange}
      />
    );
    await user.click(screen.getByText("영어 → 한국어"));
    expect(onDirectionChange).toHaveBeenCalledWith("en-ko");
    expect(onDraftChange).toHaveBeenCalledWith("");
  });

  it("submits the typed text on Enter via onTranslate(text, model, style)", async () => {
    const onTranslate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<TranslateForm onTranslate={onTranslate} isLoading={false} />);
    await user.type(screen.getByPlaceholderText(/번역할 텍스트/), "확인 부탁해");
    await user.keyboard("{Enter}");
    expect(onTranslate).toHaveBeenCalledWith("확인 부탁해", "gemini-flash-lite", "casual-work");
  });
});
