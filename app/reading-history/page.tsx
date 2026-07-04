"use client";

import { useState, useEffect, useCallback } from "react";
import { ReadingHistoryCard, type ReadingEntry } from "@/components/ReadingHistoryCard";
import { Toast } from "@/components/Toast";

interface ReadingHistoryResponse {
  entries: ReadingEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export default function ReadingHistoryPage() {
  const [entries, setEntries] = useState<ReadingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPage = useCallback(async (pageNum: number, append = false) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/reading-history?page=${pageNum}&limit=20`);
      if (!res.ok) throw new Error("failed");
      const data: ReadingHistoryResponse = await res.json();
      setEntries((prev) => (append ? [...prev, ...data.entries] : data.entries));
      setHasMore(data.hasMore);
      setTotal(data.total);
    } catch {
      showToast("읽기 기록을 불러오지 못했습니다", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchPage(1, false);
  }, [fetchPage]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("복사되었습니다!", "success");
    } catch {
      showToast("복사에 실패했습니다", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch("/api/reading-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      showToast("삭제되었습니다", "success");
    } catch {
      showToast("삭제 실패", "error");
    }
  };

  const handleClearAll = async () => {
    if (!confirm("읽기 기록을 전체 삭제할까요?")) return;
    try {
      await fetch("/api/reading-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setEntries([]);
      setTotal(0);
      showToast("전체 삭제되었습니다", "success");
    } catch {
      showToast("삭제 실패", "error");
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">
          읽기 기록 <span className="text-gray-400 font-normal">({total}개)</span>
        </h2>
        {total > 0 && (
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-red-50 transition-colors"
          >
            전체 삭제
          </button>
        )}
      </div>

      {isLoading && entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <span className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-2">로딩 중...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>읽기 기록이 없습니다.</p>
          <p className="text-sm mt-1">번역 탭에서 &quot;영어 → 한국어&quot;로 읽어보세요!</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {entries.map((entry) => (
              <ReadingHistoryCard
                key={entry.id}
                entry={entry}
                onCopy={handleCopy}
                onDelete={handleDelete}
              />
            ))}
          </div>
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
