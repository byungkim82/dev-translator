"use client";

import { useState, useEffect } from "react";
import { Toast } from "@/components/Toast";

interface Settings {
  default_model: string;
  default_style: string;
  auto_copy: number;
}

interface Stats {
  total: number;
  thisWeek: number;
  uncategorized: number;
  favorites: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    default_model: "gemini-flash-lite",
    default_style: "casual-work",
    auto_copy: 0,
  });
  const [stats, setStats] = useState<Stats>({
    total: 0,
    thisWeek: 0,
    uncategorized: 0,
    favorites: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json() as { settings: Settings; stats: Stats };
      setSettings(data.settings);
      setStats(data.stats);
    } catch (error) {
      console.error("Settings fetch error:", error);
      showToast("설정을 불러오는 데 실패했습니다", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      showToast("설정이 저장되었습니다", "success");
    } catch {
      showToast("설정 저장에 실패했습니다", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCategorize = async () => {
    if (stats.uncategorized === 0) {
      showToast("분류할 항목이 없습니다", "info");
      return;
    }

    setIsCategorizing(true);
    try {
      const res = await fetch("/api/categorize", { method: "POST" });
      if (!res.ok) throw new Error("Failed to categorize");
      const data = await res.json() as { message: string };
      showToast(data.message, "success");
      // Refresh stats
      await fetchSettings();
    } catch (error) {
      console.error("Categorization error:", error);
      showToast("분류 중 오류가 발생했습니다", "error");
    } finally {
      setIsCategorizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm text-center py-12 text-gray-500">
        <span className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-2">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Default Settings */}
      <section className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">기본 설정</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">기본 모델</label>
            <select
              value={settings.default_model}
              onChange={(e) => setSettings({ ...settings, default_model: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-md focus:outline-none focus:border-primary"
            >
              <option value="gemini-flash-lite">Gemini 2.5 Flash Lite (추천)</option>
              <option value="gemini-3-flash">Gemini 3 Flash (실험적)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">기본 스타일</label>
            <select
              value={settings.default_style}
              onChange={(e) => setSettings({ ...settings, default_style: e.target.value })}
              className="w-full p-3 border border-gray-200 rounded-md focus:outline-none focus:border-primary"
            >
              <option value="casual-work">캐주얼 업무용</option>
              <option value="formal-work">격식있는 업무용</option>
              <option value="very-casual">매우 캐주얼</option>
              <option value="technical-doc">기술 문서용</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(settings.auto_copy)}
                onChange={(e) => setSettings({ ...settings, auto_copy: e.target.checked ? 1 : 0 })}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm">번역 후 자동으로 클립보드에 복사</span>
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-primary text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "저장 중..." : "설정 저장"}
          </button>
        </div>
      </section>

      {/* Statistics */}
      <section className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">통계</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">총 번역</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.thisWeek}</div>
            <div className="text-sm text-gray-500">이번 주</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.favorites}</div>
            <div className="text-sm text-gray-500">즐겨찾기</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.uncategorized}</div>
            <div className="text-sm text-gray-500">미분류</div>
          </div>
        </div>
      </section>

      {/* Auto Categorization */}
      <section className="bg-white rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">자동 카테고리 분류</h2>
        <p className="text-sm text-gray-500 mb-4">
          미분류 항목: <strong>{stats.uncategorized}개</strong>
        </p>
        <button
          onClick={handleCategorize}
          disabled={isCategorizing || stats.uncategorized === 0}
          className="w-full py-3 bg-primary text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {isCategorizing ? "분류 중..." : "일괄 분류 실행"}
        </button>
      </section>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
