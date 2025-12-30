"use client";

import { formatDate } from "@/lib/utils";

interface Translation {
  id: string;
  korean_text: string;
  english_text: string;
  model: string;
  style: string;
  category: string | null;
  is_favorite: number;
  created_at: string;
}

interface HistoryCardProps {
  translation: Translation;
  onCopy: (text: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onDelete: (id: string) => void;
}

const STYLE_LABELS: Record<string, string> = {
  "casual-work": "캐주얼",
  "formal-work": "격식",
  "very-casual": "매우 캐주얼",
  "technical-doc": "기술 문서",
};

export function HistoryCard({
  translation,
  onCopy,
  onToggleFavorite,
  onDelete,
}: HistoryCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary hover:shadow-sm transition-all">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-gray-500">
          {formatDate(translation.created_at)}
        </span>
        <div className="flex gap-1">
          {translation.category && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
              {translation.category}
            </span>
          )}
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
            {STYLE_LABELS[translation.style] || translation.style}
          </span>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-sm font-medium text-gray-900 mb-1 line-clamp-2">
          {translation.korean_text}
        </div>
        <div className="text-sm text-gray-500 pl-3 border-l-2 border-primary line-clamp-2">
          {translation.english_text}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onCopy(translation.english_text)}
          className="p-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          title="복사"
        >
          📋
        </button>
        <button
          onClick={() => onToggleFavorite(translation.id, !translation.is_favorite)}
          className={`p-2 border rounded transition-colors ${
            translation.is_favorite
              ? "border-amber-300 bg-amber-50"
              : "border-gray-200 hover:bg-gray-50"
          }`}
          title="즐겨찾기"
        >
          {translation.is_favorite ? "⭐" : "☆"}
        </button>
        <button
          onClick={() => {
            if (confirm("정말 삭제하시겠습니까?")) {
              onDelete(translation.id);
            }
          }}
          className="p-2 border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 transition-colors"
          title="삭제"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
