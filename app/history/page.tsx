"use client";

import { useState, useEffect, useCallback } from "react";
import { HistoryList } from "@/components/HistoryList";
import { SearchFilters } from "@/components/SearchFilters";
import { Toast } from "@/components/Toast";

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

interface HistoryResponse {
  translations: Translation[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export default function HistoryPage() {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [style, setStyle] = useState("");
  const [sort, setSort] = useState("newest");
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchHistory = useCallback(async (pageNum: number, append: boolean = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "20",
        search,
        category,
        style,
        sort,
        ...(favoriteOnly && { favorite: "true" }),
      });

      const res = await fetch(`/api/history?${params}`);
      if (!res.ok) throw new Error("Failed to fetch history");

      const data: HistoryResponse = await res.json();

      if (append) {
        setTranslations((prev) => [...prev, ...data.translations]);
      } else {
        setTranslations(data.translations);
      }
      setHasMore(data.hasMore);
      setTotal(data.total);
    } catch (error) {
      console.error("History fetch error:", error);
      showToast("히스토리를 불러오는 데 실패했습니다", "error");
    } finally {
      setIsLoading(false);
    }
  }, [search, category, style, sort, favoriteOnly]);

  useEffect(() => {
    setPage(1);
    fetchHistory(1, false);
  }, [fetchHistory]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchHistory(nextPage, true);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("복사되었습니다!", "success");
    } catch {
      showToast("복사에 실패했습니다", "error");
    }
  };

  const handleToggleFavorite = async (id: string, isFavorite: boolean) => {
    try {
      await fetch("/api/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_favorite: isFavorite }),
      });
      setTranslations((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_favorite: isFavorite ? 1 : 0 } : t))
      );
      showToast(isFavorite ? "즐겨찾기에 추가됨" : "즐겨찾기에서 제거됨", "success");
    } catch {
      showToast("업데이트 실패", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch("/api/history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setTranslations((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => prev - 1);
      showToast("삭제되었습니다", "success");
    } catch {
      showToast("삭제 실패", "error");
    }
  };

  const handleExport = () => {
    window.location.href = "/api/export";
    showToast("CSV 파일 다운로드 시작", "success");
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">
          번역 히스토리 <span className="text-gray-400 font-normal">({total}개)</span>
        </h2>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
        >
          📥 CSV 내보내기
        </button>
      </div>

      <SearchFilters
        search={search}
        onSearchChange={setSearch}
        category={category}
        onCategoryChange={setCategory}
        style={style}
        onStyleChange={setStyle}
        sort={sort}
        onSortChange={setSort}
        favoriteOnly={favoriteOnly}
        onFavoriteOnlyChange={setFavoriteOnly}
      />

      {isLoading && translations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <span className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-2">로딩 중...</p>
        </div>
      ) : (
        <>
          <HistoryList
            translations={translations}
            onCopy={handleCopy}
            onToggleFavorite={handleToggleFavorite}
            onDelete={handleDelete}
          />

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="w-full mt-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {isLoading ? "로딩 중..." : "더 보기"}
            </button>
          )}
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
