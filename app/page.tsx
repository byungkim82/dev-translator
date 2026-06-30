"use client";

import { TranslateForm } from "@/components/TranslateForm";
import { TranslationResult } from "@/components/TranslationResult";
import { TmPanel } from "@/components/TmPanel";
import { Toast } from "@/components/Toast";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  applyStreamEvent,
  createNdjsonParser,
  initialStreamState,
  type StreamState,
} from "@/lib/stream-protocol";

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
  const [isStreaming, setIsStreaming] = useState(false);
  // P16 Phase 2: as-you-type Translation Memory state.
  const [draft, setDraft] = useState("");
  const [tmMatches, setTmMatches] = useState<SimilarTranslation[]>([]);
  const [tmLoading, setTmLoading] = useState(false);
  const [selectedExampleIds, setSelectedExampleIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [settings, setSettings] = useState<Settings>({
    default_model: "gemini-flash-lite",
    default_style: "casual-work",
    auto_copy: 0,
  });
  const abortRef = useRef<AbortController | null>(null);
  const tmAbortRef = useRef<AbortController | null>(null);
  // Cache TM lookups by query text so re-typing the same text (e.g. backspace +
  // retype, or submit after a pause) never re-hits the network.
  const tmCacheRef = useRef<Map<string, SimilarTranslation[]>>(new Map());

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

  // Look up similar past translations (TM). Cache-deduped per query text, with an
  // AbortController so a newer lookup supersedes an in-flight one. Stable (only
  // refs/setters), so it's safe in the debounce effect's deps.
  const fetchTm = useCallback(async (text: string) => {
    const cached = tmCacheRef.current.get(text);
    if (cached) {
      setTmMatches(cached);
      return;
    }
    tmAbortRef.current?.abort();
    const controller = new AbortController();
    tmAbortRef.current = controller;
    setTmLoading(true);
    try {
      const res = await fetch("/api/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = await res.json() as { similar?: SimilarTranslation[] };
      const matches = data.similar ?? [];
      tmCacheRef.current.set(text, matches);
      if (tmAbortRef.current === controller) setTmMatches(matches);
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      console.error("TM lookup error:", error);
      // Non-blocking: a failure just means no suggestions are shown.
    } finally {
      if (tmAbortRef.current === controller) setTmLoading(false);
    }
  }, []);

  // As-you-type: 500ms after the user stops typing (min 3 chars), refresh the TM
  // panel. The query cache makes a re-typed string instant and network-free.
  useEffect(() => {
    const text = draft.trim();
    if (text.length < 3) {
      setTmMatches([]);
      return;
    }
    const cached = tmCacheRef.current.get(text);
    if (cached) {
      setTmMatches(cached);
      return;
    }
    const handle = setTimeout(() => void fetchTm(text), 500);
    return () => clearTimeout(handle);
  }, [draft, fetchTm]);

  // Drop selected example ids that are no longer among the current matches (the
  // draft changed), so a stale selection can't ride along into the next request.
  useEffect(() => {
    setSelectedExampleIds((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(tmMatches.map((m) => m.id));
      const next = new Set([...prev].filter((id) => present.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tmMatches]);

  const toggleExample = (id: string) => {
    setSelectedExampleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTranslate = async (koreanText: string, model: string, style: string) => {
    if (!koreanText.trim()) {
      showToast("번역할 텍스트를 입력해주세요", "error");
      return;
    }

    // Make sure the TM panel reflects the submitted text even on paste + immediate
    // Enter (before the debounce fired). Cache-deduped, so a prior pause is free.
    void fetchTm(koreanText.trim());

    // Translate right away — the lookup never blocks it.
    await executeTranslation(koreanText, model, style);
  };

  // Build a (possibly partial) Translation from the accumulated stream state.
  const buildStreamResult = (
    state: StreamState,
    fb: { koreanText: string; model: string; style: string }
  ): Translation => ({
    id: state.done?.id ?? "",
    korean_text: state.meta?.korean_text ?? fb.koreanText,
    english_text: state.text,
    model: state.meta?.model ?? fb.model,
    style: state.meta?.style ?? fb.style,
    is_favorite: false,
    created_at: state.done?.created_at ?? "",
    truncated: state.done?.truncated,
  });

  // Side effects shared by the streamed and cache-hit (JSON) completion paths.
  const afterComplete = async (translation: Translation) => {
    if (settings.auto_copy) {
      await autoCopy(translation.english_text);
    }
    if (translation.truncated) {
      showToast("⚠️ 결과가 잘렸을 수 있습니다 (출력 길이 한도 초과)", "error");
    } else if (!settings.auto_copy) {
      showToast("번역이 완료되었습니다", "success");
    }
  };

  const executeTranslation = async (koreanText: string, model: string, style: string) => {
    // Cancel any in-flight translation before starting a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setIsStreaming(false);
    // Clear the previous translation so its text doesn't linger under the
    // streaming cursor while the first token of the new one is on its way.
    setResult(null);
    // P16 Phase 2: opt-in TM examples, in similarity order (strongest first).
    const exampleIds = tmMatches
      .filter((m) => selectedExampleIds.has(m.id))
      .map((m) => m.id);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ koreanText, model, style, exampleIds }),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";

      // Cache hit or a pre-stream error comes back as plain JSON.
      if (contentType.includes("application/json")) {
        const data = await res.json() as Translation & { error?: string };
        if (!res.ok) throw new Error(data.error || "Translation failed");
        setResult(data);
        await afterComplete(data);
        return;
      }

      // Fresh translation: consume the NDJSON stream and render progressively.
      if (!res.body) throw new Error("스트리밍 응답을 읽을 수 없습니다");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createNdjsonParser();
      let state = initialStreamState();
      const fb = { koreanText, model, style };

      setIsStreaming(true);
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const event of parser.push(decoder.decode(value, { stream: true }))) {
          state = applyStreamEvent(state, event);
          if (event.type === "error") {
            throw new Error(state.error || "번역 중 오류가 발생했습니다");
          }
          if (event.type === "delta") {
            setResult(buildStreamResult(state, fb));
          }
        }
      }

      if (state.done) {
        const final = buildStreamResult(state, fb);
        setResult(final);
        await afterComplete(final);
      } else {
        showToast("응답이 중단되었습니다", "error");
      }
    } catch (error) {
      // A new translation aborting this one is expected — stay silent.
      if ((error as Error)?.name === "AbortError") return;
      console.error("Translation error:", error);
      showToast(error instanceof Error ? error.message : "번역 중 오류가 발생했습니다", "error");
    } finally {
      // Only the current request resets shared UI state (avoids an aborted
      // previous request clobbering the new one's loading state).
      if (abortRef.current === controller) {
        setIsStreaming(false);
        setIsLoading(false);
      }
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
        onDraftChange={setDraft}
      />

      <TmPanel
        matches={tmMatches}
        selectedIds={selectedExampleIds}
        loading={tmLoading}
        onToggleExample={toggleExample}
        onUseSimilar={handleUseSimilar}
      />

      {result && (
        <TranslationResult
          translation={result}
          streaming={isStreaming}
          onCopy={handleCopy}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
