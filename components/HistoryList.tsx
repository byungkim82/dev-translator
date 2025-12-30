"use client";

import { HistoryCard } from "./HistoryCard";

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

interface HistoryListProps {
  translations: Translation[];
  onCopy: (text: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onDelete: (id: string) => void;
}

export function HistoryList({
  translations,
  onCopy,
  onToggleFavorite,
  onDelete,
}: HistoryListProps) {
  if (translations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>저장된 번역이 없습니다.</p>
        <p className="text-sm mt-1">번역 탭에서 번역을 시작해보세요!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {translations.map((translation) => (
        <HistoryCard
          key={translation.id}
          translation={translation}
          onCopy={onCopy}
          onToggleFavorite={onToggleFavorite}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
