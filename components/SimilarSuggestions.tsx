"use client";

import type { SimilarTranslation } from "@/app/page";

interface SimilarSuggestionsProps {
  translations: SimilarTranslation[];
  onUseSimilar: (translation: SimilarTranslation) => void;
}

// Non-blocking panel shown below the result (W6). Surfaces similar past
// translations without interrupting the flow; clicking one reuses it.
export function SimilarSuggestions({
  translations,
  onUseSimilar,
}: SimilarSuggestionsProps) {
  if (translations.length === 0) return null;

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <span>💡</span>
        <h3 className="text-sm font-semibold">비슷한 과거 번역</h3>
        <span className="text-xs text-gray-400">클릭하면 그 번역으로 교체됩니다</span>
      </div>

      <div className="space-y-3">
        {translations.map((t) => (
          <div key={t.id} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                {Math.round(t.similarity * 100)}% 유사
              </span>
              <button
                onClick={() => onUseSimilar(t)}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                이걸로 교체
              </button>
            </div>
            <div className="text-sm font-medium text-gray-900 mb-1">{t.korean_text}</div>
            <div className="text-sm text-gray-500 pl-3 border-l-2 border-primary">
              {t.english_text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
