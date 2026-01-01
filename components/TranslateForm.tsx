"use client";

import { useState } from "react";

interface TranslateFormProps {
  onTranslate: (koreanText: string, model: string, style: string) => Promise<void>;
  isLoading: boolean;
}

const MODELS = [
  { value: "gemini-flash", label: "Gemini Flash" },
];

const STYLES = [
  { value: "casual-work", label: "캐주얼 업무용" },
  { value: "formal-work", label: "격식있는 업무용" },
  { value: "very-casual", label: "매우 캐주얼" },
  { value: "technical-doc", label: "기술 문서용" },
];

export function TranslateForm({ onTranslate, isLoading }: TranslateFormProps) {
  const [koreanText, setKoreanText] = useState("");
  const [model, setModel] = useState("gemini-flash");
  const [style, setStyle] = useState("casual-work");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onTranslate(koreanText, model, style);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onTranslate(koreanText, model, style);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 shadow-sm space-y-4">
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

      <div>
        <label className="block text-sm font-medium mb-2">한국어 입력</label>
        <textarea
          value={koreanText}
          onChange={(e) => setKoreanText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="번역할 텍스트를 입력하세요... (Enter로 번역, Shift+Enter로 줄바꿈)"
          rows={5}
          className="w-full p-3 border border-gray-200 rounded-md resize-y focus:outline-none focus:border-primary"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !koreanText.trim()}
        className="w-full py-3 px-6 bg-primary text-white font-medium rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
