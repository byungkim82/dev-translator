"use client";

import { formatDate } from "@/lib/utils";

export interface ReadingEntry {
  id: string;
  source_text: string; // incoming English (input)
  target_text: string; // Korean output
  created_at: string;
}

interface ReadingHistoryCardProps {
  entry: ReadingEntry;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}

export function ReadingHistoryCard({ entry, onCopy, onDelete }: ReadingHistoryCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary hover:shadow-sm transition-all">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">영 → 한</span>
      </div>

      <div className="mb-3">
        <div className="text-sm text-gray-500 mb-1 line-clamp-2">{entry.source_text}</div>
        <div className="text-sm font-medium text-gray-900 pl-3 border-l-2 border-primary line-clamp-3">
          {entry.target_text}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onCopy(entry.target_text)}
          className="p-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          title="한국어 복사"
        >
          📋
        </button>
        <button
          onClick={() => {
            if (confirm("정말 삭제하시겠습니까?")) onDelete(entry.id);
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
