"use client";

import { TranslateForm } from "@/components/TranslateForm";
import { TranslationResult } from "@/components/TranslationResult";
import { SimilarSuggestions } from "@/components/SimilarSuggestions";
import { Toast } from "@/components/Toast";
import { useState, useEffect } from "react";

export interface Translation {
  id: string;
  korean_text: string;
  english_text: string;
  model: string;
  style: string;
  category?: string;
  is_favorite: boolean;
  created_at: string;
  truncated?: boolean;
}

export interface SimilarTranslation extends Translation {
  similarity: number;
}

interface Settings {
  default_model: string;
  default_style: string;
  auto_copy: number;
}

export default function HomePage() {
  const [result, setResult] = useState<Translation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [similarTranslations, setSimilarTranslations] = useState<SimilarTranslation[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [settings, setSettings] = useState<Settings>({
    default_model: "gemini-flash-lite",
    default_style: "casual-work",
    auto_copy: 0,
  });

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Auto-copy the result to the clipboard when the setting is enabled, so the
  // user can paste straight into Slack without clicking the copy button.
  const autoCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("자동 복사됨 — Slack에 붙여넣으세요", "success");
    } catch {
      showToast("자동 복사 실패 — 복사 버튼을 눌러주세요", "error");
    }
  };

  useEffect(() => {
    // Fetch settings on mount
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json() as { settings: Settings };
          setSettings(data.settings);
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      }
    };
    fetchSettings();
  }, []);

  const handleTranslate = async (koreanText: string, model: string, style: string) => {
    if (!koreanText.trim()) {
      showToast("번역할 텍스트를 입력해주세요", "error");
      return;
    }

    // Clear suggestions from a previous translation, then surface similar past
    // translations in the background — this never blocks the new translation.
    setSimilarTranslations([]);
    void fetchSimilar(koreanText);

    // Translate right away.
    await executeTranslation(koreanText, model, style);
  };

  const fetchSimilar = async (koreanText: string) => {
    try {
      const res = await fetch("/api/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: koreanText }),
      });
      if (!res.ok) return;
      const data = await res.json() as { similar?: SimilarTranslation[] };
      if (data.similar && data.similar.length > 0) {
        setSimilarTranslations(data.similar);
      }
    } catch (error) {
      console.error("Similar search error:", error);
      // Non-blocking: a failure just means no suggestions are shown.
    }
  };

  const executeTranslation = async (koreanText: string, model: string, style: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ koreanText, model, style }),
      });

      if (!res.ok) {
        const error = await res.json() as { error?: string };
        throw new Error(error.error || "Translation failed");
      }

      const translation = await res.json() as Translation;
      setResult(translation);
      if (settings.auto_copy) {
        await autoCopy(translation.english_text);
      }
      if (translation.truncated) {
        showToast("⚠️ 결과가 잘렸을 수 있습니다 (출력 길이 한도 초과)", "error");
      } else if (!settings.auto_copy) {
        showToast("번역이 완료되었습니다", "success");
      }
    } catch (error) {
      console.error("Translation error:", error);
      showToast(error instanceof Error ? error.message : "번역 중 오류가 발생했습니다", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseSimilar = (translation: SimilarTranslation) => {
    setResult({
      ...translation,
      is_favorite: Boolean(translation.is_favorite),
    });
    if (settings.auto_copy) {
      void autoCopy(translation.english_text);
    } else {
      showToast("기존 번역을 사용했습니다", "success");
    }
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
      if (result && result.id === id) {
        setResult({ ...result, is_favorite: isFavorite });
      }
      showToast(isFavorite ? "즐겨찾기에 추가됨" : "즐겨찾기에서 제거됨", "success");
    } catch {
      showToast("업데이트 실패", "error");
    }
  };

  return (
    <div className="space-y-6">
      <TranslateForm
        onTranslate={handleTranslate}
        isLoading={isLoading}
        defaultModel={settings.default_model}
        defaultStyle={settings.default_style}
      />

      {result && (
        <TranslationResult
          translation={result}
          onCopy={handleCopy}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {result && (
        <SimilarSuggestions
          translations={similarTranslations}
          onUseSimilar={handleUseSimilar}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
