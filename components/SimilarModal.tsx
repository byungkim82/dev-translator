"use client";

import type { SimilarTranslation } from "@/app/page";

interface SimilarModalProps {
  translations: SimilarTranslation[];
  onUseSimilar: (translation: SimilarTranslation) => void;
  onTranslateNew: () => void;
  onClose: () => void;
}

export function SimilarModal({
  translations,
  onUseSimilar,
  onTranslateNew,
  onClose,
}: SimilarModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">유사한 번역을 찾았습니다</h3>
          <p className="text-sm text-gray-500 mt-1">
            과거에 비슷한 문장을 번역한 적이 있습니다. 이 번역을 사용하시겠습니까?
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[400px] space-y-4">
          {translations.map((t, index) => (
            <button
              key={t.id}
              onClick={() => onUseSimilar(t)}
              className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-primary hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                  {Math.round(t.similarity * 100)}% 유사
                </span>
                {index === 0 && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                    추천
                  </span>
                )}
              </div>
              <div className="text-sm font-medium text-gray-900 mb-1">
                {t.korean_text}
              </div>
              <div className="text-sm text-gray-500 pl-3 border-l-2 border-primary">
                {t.english_text}
              </div>
            </button>
          ))}
        </div>

        <div className="p-6 border-t flex gap-3">
          <button
            onClick={onTranslateNew}
            className="flex-1 py-3 px-4 bg-gradient-primary text-white rounded-md hover:opacity-90 shadow-md transition-all font-medium"
          >
            새로 번역
          </button>
          <button
            onClick={onClose}
            className="py-3 px-4 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
