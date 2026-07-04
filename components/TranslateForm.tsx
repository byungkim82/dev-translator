"use client";

import { useState, useEffect } from "react";

interface TranslateFormProps {
  // First arg is the input text (Korean for ko-en, English for en-ko reading).
  onTranslate: (text: string, model: string, style: string) => Promise<void>;
  isLoading: boolean;
  defaultModel?: string;
  defaultStyle?: string;
  // P16 Phase 2: emit the draft text on every change so the page can run the
  // debounced as-you-type TM lookup. Optional — omitting it is a no-op.
  onDraftChange?: (text: string) => void;
  // F11: reading-mode direction, controlled by the page. Optional (defaults to
  // ko-en) so omitting both props keeps the exact pre-F11 behavior (no-regression).
  direction?: "ko-en" | "en-ko";
  onDirectionChange?: (d: "ko-en" | "en-ko") => void;
}

const MODELS = [
  { value: "gemini-flash-lite", label: "Gemini 3.1 Flash Lite (추천)" },
  { value: "gemini-3-flash", label: "Gemini 3.5 Flash (고품질)" },
];

const STYLES = [
  { value: "casual-work", label: "캐주얼 업무용" },
  { value: "formal-work", label: "격식있는 업무용" },
  { value: "very-casual", label: "매우 캐주얼" },
  { value: "technical-doc", label: "기술 문서용" },
];

export function TranslateForm({
  onTranslate,
  isLoading,
  defaultModel = "gemini-flash-lite",
  defaultStyle = "casual-work",
  onDraftChange,
  direction = "ko-en",
  onDirectionChange,
}: TranslateFormProps) {
  const [inputText, setInputText] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [style, setStyle] = useState(defaultStyle);

  const isReading = direction === "en-ko";

  // Update state when default props change
  useEffect(() => {
    setModel(defaultModel);
  }, [defaultModel]);

  useEffect(() => {
    setStyle(defaultStyle);
  }, [defaultStyle]);

  // F11: switching direction clears the local input (KO input vs EN input are
  // unrelated) and notifies the page (which clears result/TM state + aborts).
  const handleDirectionChange = (d: "ko-en" | "en-ko") => {
    if (d === direction) return;
    setInputText("");
    onDraftChange?.("");
    onDirectionChange?.(d);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onTranslate(inputText, model, style);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onTranslate(inputText, model, style);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 shadow-sm space-y-4">
      {/* F11: translation direction toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleDirectionChange("ko-en")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            !isReading
              ? "bg-gradient-primary text-white shadow-md"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          한국어 → 영어
        </button>
        <button
          type="button"
          onClick={() => handleDirectionChange("en-ko")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            isReading
              ? "bg-gradient-primary text-white shadow-md"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          영어 → 한국어
        </button>
      </div>

      {/* Reading mode has no model/style controls: it's locked to the cheap/fast
          model (premium is pointless for comprehension) and is style-less. */}
      {!isReading && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">모델</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-md focus:outline-none focus:border-primary"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">스타일</label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-md focus:outline-none focus:border-primary"
            >
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">
          {isReading ? "영어 입력" : "한국어 입력"}
        </label>
        <textarea
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            onDraftChange?.(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            isReading
              ? "이해할 영어 메시지를 붙여넣으세요... (Enter로 번역, Shift+Enter로 줄바꿈)"
              : "번역할 텍스트를 입력하세요... (Enter로 번역, Shift+Enter로 줄바꿈)"
          }
          rows={5}
          className="w-full p-3 border border-gray-200 rounded-md resize-y focus:outline-none focus:border-primary"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !inputText.trim()}
        className="w-full py-3 px-6 bg-gradient-primary text-white font-medium rounded-md hover:opacity-90 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            번역 중...
          </>
        ) : (
          "번역하기"
        )}
      </button>
    </form>
  );
}
