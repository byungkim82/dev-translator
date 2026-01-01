"use client";

import { CATEGORIES } from "@/lib/prompts";

interface SearchFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  style: string;
  onStyleChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (value: boolean) => void;
}

const STYLES = [
  { value: "", label: "모든 스타일" },
  { value: "casual-work", label: "캐주얼 업무용" },
  { value: "formal-work", label: "격식있는 업무용" },
  { value: "very-casual", label: "매우 캐주얼" },
  { value: "technical-doc", label: "기술 문서용" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
  { value: "alphabetical", label: "가나다순" },
];

export function SearchFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  style,
  onStyleChange,
  sort,
  onSortChange,
  favoriteOnly,
  onFavoriteOnlyChange,
}: SearchFiltersProps) {
  return (
    <div className="space-y-4 mb-6">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="🔍 검색..."
        className="w-full p-3 border border-gray-200 rounded-md focus:outline-none focus:border-primary"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="p-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-primary"
        >
          <option value="">모든 카테고리</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={style}
          onChange={(e) => onStyleChange(e.target.value)}
          className="p-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-primary"
        >
          {STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="p-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-primary"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 p-2 border border-gray-200 rounded-md text-sm cursor-pointer hover:bg-gray-50">
          <input
            type="checkbox"
            checked={favoriteOnly}
            onChange={(e) => onFavoriteOnlyChange(e.target.checked)}
            className="accent-primary"
          />
          ⭐ 즐겨찾기만
        </label>
      </div>
    </div>
  );
}
