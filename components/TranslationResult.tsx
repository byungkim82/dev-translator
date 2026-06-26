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
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">영어 결과</label>
        <div className="p-4 bg-gray-50 rounded-md border border-gray-200 whitespace-pre-wrap min-h-[120px]">
          {translation.english_text}
          {streaming && (
            <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-gray-400 animate-pulse" />
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onCopy(translation.english_text)}
          className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          <span>📋</span> 복사
        </button>
        <button
          onClick={() => onToggleFavorite(translation.id, !translation.is_favorite)}
          disabled={streaming}
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
