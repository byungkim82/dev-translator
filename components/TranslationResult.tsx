"use client";

import type { Translation } from "@/app/page";

interface TranslationResultProps {
  translation: Translation;
  streaming?: boolean;
  onCopy: (text: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
}

export function TranslationResult({
  translation,
  streaming = false,
  onCopy,
  onToggleFavorite,
}: TranslationResultProps) {
  // F11: direction-aware output. undefined/"ko-en" => English result (backward
  // compatible with pre-F11 results). "en-ko" reading => Korean result.
  const isReading = translation.direction === "en-ko";
  const outputLabel = isReading ? "한국어 결과" : "영어 결과";
  const outputText = isReading ? translation.korean_text : translation.english_text;

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">{outputLabel}</label>
        <div className="p-4 bg-gray-50 rounded-md border border-gray-200 whitespace-pre-wrap min-h-[120px]">
          {outputText}
          {streaming && (
            <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-gray-400 animate-pulse" />
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onCopy(outputText)}
          className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          <span>📋</span> 복사
        </button>
        <button
          onClick={() => onToggleFavorite(translation.id, !translation.is_favorite)}
          // Disabled while streaming, and for ephemeral reading results (id === "",
          // no persisted row to favorite).
          disabled={streaming || !translation.id}
          className={`flex-1 py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            translation.is_favorite
              ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          <span>{translation.is_favorite ? "⭐" : "☆"}</span>
          {translation.is_favorite ? "즐겨찾기됨" : "즐겨찾기"}
        </button>
      </div>
    </div>
  );
}
