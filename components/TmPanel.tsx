"use client";

import type { SimilarTranslation } from "@/app/page";

interface TmPanelProps {
  matches: SimilarTranslation[];
  // Ids of matches the user opted in as few-shot examples (P16 Phase 2).
  selectedIds: Set<string>;
  loading: boolean;
  onToggleExample: (id: string) => void;
  onUseSimilar: (translation: SimilarTranslation) => void;
}

// P16 Phase 2: the as-you-type Translation Memory panel. Shown below the input
// (during typing, not just after a translation) whenever similar past
// translations exist. Each match offers two affordances:
//   - "이걸로 교체" — reuse the past translation wholesale (W6, any match)
//   - "예시로 참고" checkbox — opt the match in as a few-shot style example
//     (favorited matches only; ids flow to /api/translate as exampleIds)
export function TmPanel({
  matches,
  selectedIds,
  loading,
  onToggleExample,
  onUseSimilar,
}: TmPanelProps) {
  // Nothing to show and not searching -> render nothing (avoids an empty box).
  if (matches.length === 0 && !loading) return null;

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <span>💡</span>
        <h3 className="text-sm font-semibold">비슷한 과거 번역</h3>
        {loading ? (
          <span className="text-xs text-gray-400">검색 중…</span>
        ) : (
          <span className="text-xs text-gray-400">교체하거나, 즐겨찾기는 예시로 참고할 수 있어요</span>
        )}
      </div>

      {selectedIds.size > 0 && (
        <p className="text-xs text-primary">
          예시 {selectedIds.size}개 적용 — 번역에 반영됩니다
        </p>
      )}

      <div className="space-y-3">
        {matches.map((t) => (
          <div key={t.id} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                {Math.round(t.similarity * 100)}% 유사
              </span>
              <div className="flex items-center gap-3">
                {t.is_favorite && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => onToggleExample(t.id)}
                    />
                    예시로 참고
                  </label>
                )}
                <button
                  onClick={() => onUseSimilar(t)}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  이걸로 교체
                </button>
              </div>
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
