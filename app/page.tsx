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
  // F11: translation direction. undefined => ko-en (backward compatible).
  direction?: "ko-en" | "en-ko";
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
  // F11: reading-mode direction (ko-en = KO→EN writing, en-ko = EN→KO reading).
  const [direction, setDirection] = useState<"ko-en" | "en-ko">("ko-en");
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
    // F11: TM is KO→EN only — reading mode (English input) has no personalized
    // corpus, so skip the lookup entirely.
    if (direction !== "ko-en") {
      setTmMatches([]);
      return;
    }
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
  }, [draft, direction, fetchTm]);

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

  // F11: switch translation direction. Clears the result + all TM state, and
  // aborts BOTH the in-flight TM lookup AND the live translation stream. Aborting
  // the translation is required: otherwise the running reader loop keeps calling
  // setResult with the OLD direction, leaving the label/result inconsistent with
  // the new toggle (and, with auto_copy, copying English on a reading switch).
  const handleDirectionChange = (d: "ko-en" | "en-ko") => {
    setDirection(d);
    setResult(null);
    setTmMatches([]);
    setSelectedExampleIds(new Set());
    tmAbortRef.current?.abort();
    abortRef.current?.abort();
  };

  const handleTranslate = async (text: string, model: string, style: string) => {
    if (!text.trim()) {
      showToast("번역할 텍스트를 입력해주세요", "error");
      return;
    }

    // TM only applies to KO→EN (reading mode has no personalized corpus). Cache-
    // deduped, so this stays free even on paste + immediate Enter after a pause.
    if (direction === "ko-en") void fetchTm(text.trim());

    // Translate right away — the lookup never blocks it.
    await executeTranslation(text, model, style, direction);
  };

  // Build a (possibly partial) Translation from the accumulated stream state.
  const buildStreamResult = (
    state: StreamState,
    fb: { text: string; model: string; style: string; direction: "ko-en" | "en-ko" }
  ): Translation => {
    // Accumulated deltas while streaming; server-cleaned output after `done`.
    const output = state.text;
    if (fb.direction === "en-ko") {
      return {
        id: state.done?.id ?? "", // reading: always "" (ephemeral, no DB row)
        korean_text: output, // Korean OUTPUT (invariant: korean_text = the Korean side)
        english_text: fb.text, // English INPUT
        model: state.meta?.model ?? fb.model,
        style: "reading",
        is_favorite: false,
        created_at: state.done?.created_at ?? "",
        truncated: state.done?.truncated,
        direction: "en-ko",
      };
    }
    return {
      id: state.done?.id ?? "",
      korean_text: state.meta?.korean_text ?? fb.text, // Korean INPUT
      english_text: output, // English OUTPUT
      model: state.meta?.model ?? fb.model,
      style: state.meta?.style ?? fb.style,
      is_favorite: false,
      created_at: state.done?.created_at ?? "",
      truncated: state.done?.truncated,
      direction: "ko-en",
    };
  };

  // Side effects shared by the streamed and cache-hit (JSON) completion paths.
  const afterComplete = async (translation: Translation, dir: "ko-en" | "en-ko") => {
    // Auto-copy only for KO→EN (reading output isn't something you paste to Slack).
    // autoCopy shows its own success/failure toast.
    const autoCopied = dir === "ko-en" && Boolean(settings.auto_copy);
    if (autoCopied) {
      await autoCopy(translation.english_text);
    }
    if (translation.truncated) {
      showToast("⚠️ 결과가 잘렸을 수 있습니다 (출력 길이 한도 초과)", "error");
    } else if (!autoCopied) {
      showToast("번역이 완료되었습니다", "success");
    }
  };

  const executeTranslation = async (
    text: string,
    model: string,
    style: string,
    dir: "ko-en" | "en-ko"
  ) => {
    // Cancel any in-flight translation before starting a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setIsStreaming(false);
    // Clear the previous translation so its text doesn't linger under the
    // streaming cursor while the first token of the new one is on its way.
    setResult(null);

    const isReading = dir === "en-ko";
    const url = isReading ? "/api/read" : "/api/translate";
    // Reading has no examples; KO→EN sends opt-in TM examples (strongest first).
    const exampleIds = isReading
      ? []
      : tmMatches.filter((m) => selectedExampleIds.has(m.id)).map((m) => m.id);
    const body = isReading
      // Reading is locked to the cheap default model server-side (no model sent).
      ? JSON.stringify({ englishText: text })
      : JSON.stringify({ koreanText: text, model, style, exampleIds });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";

      // Cache hit (KO→EN) or a pre-stream error comes back as plain JSON. Reading
      // success is always a stream, so JSON there only ever means an error.
      if (contentType.includes("application/json")) {
        const data = await res.json() as Translation & { error?: string };
        if (!res.ok) throw new Error(data.error || "Translation failed");
        const final = { ...data, direction: dir };
        setResult(final);
        await afterComplete(final, dir);
        return;
      }

      // Fresh translation: consume the NDJSON stream and render progressively.
      if (!res.body) throw new Error("스트리밍 응답을 읽을 수 없습니다");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createNdjsonParser();
      let state = initialStreamState();
      const fb = { text, model, style, direction: dir };

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
        await afterComplete(final, dir);
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
      direction: "ko-en", // similar suggestions only surface in KO→EN mode
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
        direction={direction}
        onDirectionChange={handleDirectionChange}
      />

      {direction === "ko-en" && (
        <TmPanel
          matches={tmMatches}
          selectedIds={selectedExampleIds}
          loading={tmLoading}
          onToggleExample={toggleExample}
          onUseSimilar={handleUseSimilar}
        />
      )}

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
