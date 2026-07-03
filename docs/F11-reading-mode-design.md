# F11 설계·구현 계획 — 영어 → 한국어 (읽기 모드)

> 백로그 항목 **F11** (`docs/IMPROVEMENTS.md`)의 상세 설계·구현 계획 문서.
> **상태:** 설계 확정 (사인오프 완료) · 리뷰 2회 반영(rev3) · 구현 미착수
> **작성:** 2026-07-03
> **rev2(2026-07-03) — 리뷰 반영:** ① TM 스킵 근거 정정("벡터공간 불일치"는 오정보 — bge-m3는 다국어 공유 임베딩 공간이라 cross-lingual 검색이 *됨*; 진짜 이유는 **코퍼스 목적 불일치**). ② 방향 전환 시 진행 중 본 번역 `abortRef` abort 추가(+테스트) — 안 하면 §8 "잔여물 렌더 방지"를 스스로 위반. ③ 온도: 스타일 키 오버로딩 제거 → 전용 `"reading"=0.3` 키(additive). ④ `afterComplete` 정리 + `koreanText`→`inputText` 리네임.
> **rev3(2026-07-03) — 2차 리뷰 반영:** ⑤ 테스트 6.4-#5 재작성 — 기존 mock이 `init.signal`을 무시해 **공허 통과(fix 유무 무관)**하던 것을 **signal→body `error` 배선 + 라벨 부재 단언**으로 교체(실제 abort 회귀를 포착). ⑥ §2 다이어그램 온도 인자 `"technical-doc"`→`"reading"` 정정(rev2 고아 참조 제거).
> **목표:** 워크플로우의 나머지 절반 — 들어오는 영어 Slack/PR/이슈 메시지를 *자연스러운 한국어로 빠르게 이해*. 현재 한→영 단방향을 양방향으로.
> **진행 규칙:** 모든 변경은 테스트 동반(Vitest). 단순·저위험·additive/opt-in 우선. 작동하는 앱(한→영·W7 스트리밍·W9 캐시·P16 TM)을 깨지 말 것.

---

## 0. 핵심 통찰 (설계의 축)

읽기 모드는 **"남이 보낸 영어를 빠르게 이해"** 하는 것이다. 반면 앱의 KO-중심 인프라 — W9 캐시, TM/유사(`/api/similar`), few-shot 예시(`lib/examples.ts`), 즐겨찾기, bge-m3 백그라운드 임베딩 — 는 전부 **"내가 내보내는 한→영 목소리를 재활용"** 하기 위한 것이다. 읽는 행위는 그 코퍼스와 무관하다 (내가 남의 영어를 *어떻게 이해했는지*를 재사용하지 않는다).

→ **결론: 읽기 모드는 일회성(ephemeral).** DB에 저장하지 않고, 캐시·TM·임베딩·스키마를 **아예 건드리지 않는다.** 이 한 가지 결정이 아래 네 함정을 전부 원천 차단한다.

| 사용자가 경고한 함정 | 이 설계의 회피 방식 |
|---|---|
| `korean_text`/`english_text` 컬럼 의미 반전 | **DB에 안 씀** → 저장 레벨 반전 없음. 클라 임시 객체에서만 다루되 불변식 고정(§4). |
| W9 캐시에 방향 오염 (P16 트랩 재발) | 읽기는 캐시를 **조회도 저장도 안 함** |
| TM/few-shot을 읽기에서 스킵할지 | **스킵** — 이유는 *코퍼스 목적 불일치*. 저장 TM은 "내가 내보낸 KO→EN" 코퍼스라 남의 영어를 이해하는 데 내 과거 한국어 어투를 끌어오는 건 무의미(관련성 문제). ※ bge-m3는 **다국어 공유 임베딩 공간**이라 영어 쿼리로 한국어 항목 *검색은 됨* — 벡터공간 문제가 아님. |
| DB 스키마 영향 | **마이그레이션 0개** |

---

## 1. 확정된 결정 (사인오프 완료)

| # | 결정 | 확정안 |
|---|------|--------|
| **A** | 방향 토글 UX·기본값·상태 위치 | 세그먼트 토글 `[한국어→영어 | 영어→한국어]`. **기본 = 한→영**(무회귀). `direction` 상태는 **page 레벨**(엔드포인트 선택·TM 표시·결과 렌더가 모두 필요). settings 영속화 **안 함**(매 로드 한→영 시작). |
| **B** | 역방향 프롬프트·스타일 | **스타일 없음, 단일 프롬프트** `buildReadingPrompt`. 영→한 시 스타일 셀렉터 숨김, **모델 셀렉터는 유지**. glossary/context/few-shot **미주입**. 영어 기술용어는 **영어 그대로 유지**(Q2의 역방향). |
| **C** ⚠️ | KO-중심 저장·캐시·TM 상호작용 | **일회성.** DB 저장 없음 → 캐시·TM·임베딩·스키마 무접촉(§0). |
| **D** | 무회귀 | `direction` 없거나 `'ko-en'` = **기존 코드 경로 100% 그대로**. `/api/translate`·`buildTranslationPrompt` **미변경**. 읽기는 **신규** `buildReadingPrompt`·`/api/read`로만. |
| **E** | 엔드포인트 구조 | **별도 `/api/read`**(신규, 얇음). 기존 라우트 무접촉 → KO→EN 무회귀 보장. 스트리밍 헬퍼는 `lib/`에서 재사용. |
| **F** | 온도 | `STYLE_TEMPERATURES`에 **전용 `"reading"` 키(0.3) 추가**(순수 additive → 기존 스타일 무회귀). 스타일 키 오버로딩 없음. 0.3은 프롬프트의 "자연스러운 한국어" 요구와 정합(0.1은 직역적이라 상충) — 충실성은 프롬프트 지시로 보장, 온도는 독립 튜닝. |
| **G** | 결과 렌더·즐겨찾기·자동복사 | `TranslationResult` direction-aware(라벨 "한국어 결과"/출력=korean_text). 일회성이라 **id 없음 → 즐겨찾기 비활성**. **자동복사는 한→영에서만**(읽기는 붙여넣기 대상 아님). 복사 버튼은 양쪽 동작. |

---

## 2. 아키텍처 / 데이터 흐름

```
[영어 입력] --(direction='en-ko')--> page.executeTranslation
     └─ TM 조회 안 함, exampleIds 없음
     └─ POST /api/read { englishText, model }
          └─ buildReadingPrompt(englishText)        (신규 순수 함수)
          └─ streamGeminiText(prompt, key, model, "reading")   (재사용 · 온도 0.3, §5.1.1)
          └─ W7 NDJSON 프로토콜 재사용: meta → delta* → done          (재사용)
          └─ 캐시/settings로드/examples/finalizeTranslation/recordEdgeEmbedding 전부 없음
     └─ 클라: 동일 NDJSON 소비기 → korean_text에 스트림 텍스트 누적(§4)
     └─ 저장·즐겨찾기·자동복사·히스토리 없음 (일회성)
```

한→영 경로는 **글자 하나 바뀌지 않는다**(신규 라우트/함수만 추가).

---

## 3. 무엇을 재사용하나 (신규 표면 최소화)

| 부품 | 위치 | 상태 |
|------|------|------|
| SSE 파서 + 델타 추출 | `lib/ai/sse.ts` | 재사용, 변경 없음 |
| 스트리밍 Gemini 텍스트 생성 | `lib/ai/gemini.ts` `streamGeminiText` | 재사용, 변경 없음 |
| 출력 후처리(따옴표/접두사 제거) | `lib/ai/gemini.ts` `cleanGeminiOutput` | 재사용, 변경 없음 |
| NDJSON 인코드/디코드/리듀서 | `lib/stream-protocol.ts` | 재사용, **변경 없음**(§4) |
| 클라 NDJSON 소비 로직 | `app/page.tsx` `executeTranslation` | 파라미터화(direction) |

**신규 파일은 2개뿐:** `app/api/read/route.ts`, `components/TranslateForm.test.tsx`(+선택 `components/TranslationResult.test.tsx`).

---

## 4. ⚠️ 프로토콜 재사용의 핵심 (반드시 이해할 것)

W7 NDJSON 프로토콜(`lib/stream-protocol.ts`)은 **변경하지 않는다.** 대신 아래 두 규칙으로 재사용한다.

**(1) `done.english_text`는 "언어"가 아니라 "최종 정제된 출력 텍스트"다.**
- 한→영: `done.english_text` = 정제된 영어 출력.
- 영→한: `done.english_text` = 정제된 **한국어** 출력. (필드명은 오해 소지가 있으나 기능적으로 "final cleaned output"이다.)
- `applyStreamEvent`의 `done` 케이스가 `text: event.english_text`로 누적 텍스트를 서버 정제본으로 대체 → 양방향 모두 자동 처리됨.

**(2) 클라이언트 불변식: `korean_text`는 *항상 한국어 쪽*, `english_text`는 *항상 영어 쪽*, `direction`이 소스를 알려준다.**
- 한→영: `korean_text`=입력(KO), `english_text`=출력(EN).
- 영→한: `korean_text`=출력(KO), `english_text`=입력(EN).
- **하위호환:** `direction`이 `undefined`이면 한→영으로 렌더(기존 결과 객체 무영향). 오직 읽기 결과만 `direction:'en-ko'`를 명시(§6.2 `buildStreamResult`).

`/api/read`는 `done`의 `id`/`created_at`를 빈 문자열로 보낸다(일회성, DB 행 없음). 클라는 `id === ""`로 즐겨찾기를 비활성화한다.

---

## 5. PR-a — 백엔드 (UI 없음, 무회귀 선행, 단독 배포 가능)

배포해도 사용자 화면은 무변화(아직 아무도 `/api/read`·direction을 호출하지 않음). 이 시점에서 KO→EN 회귀는 구조적으로 불가능(신규 파일만 추가).

### 5.0 시작 체크리스트
- [ ] `docs/IMPROVEMENTS.md`: F11 상태 🔲→🚧, 대시보드 행 갱신, F11 섹션에 본 문서 링크 추가.

### 5.1 `lib/prompts.ts` — `buildReadingPrompt` 추가 (기존 함수 미변경)

파일 **맨 끝**(또는 `buildTranslationPrompt` 아래)에 추가. `STYLE_PROMPTS`/`buildTranslationPrompt`/`CODE_PRESERVATION_RULE`는 **손대지 않는다.**

```ts
// F11: reverse direction (English → Korean, reading mode). A SINGLE prompt with
// NO style variants — reading mode is about fast comprehension, not outgoing tone.
// Kept fully separate from buildTranslationPrompt so the KO→EN path is byte-for-
// byte unchanged (no-regression). Mirrors CODE_PRESERVATION_RULE in reverse: keep
// English tech terms in English (a Korean dev reads "deploy" faster than "배포").
export function buildReadingPrompt(englishText: string): string {
  return `Translate the following English message (from a US tech company Slack, PR, or issue) into natural, clear Korean that a Korean developer can understand at a glance. Focus on:
- Fast comprehension over polish — natural Korean a developer actually uses, not stiff textbook Korean
- Faithful meaning AND intent (is it a request, a heads-up, a question, an FYI?)
- Keep English technical terms, code identifiers, commands, file names, and product names in English (deploy, merge, rebase, staging, PR, rollback, standup, function/variable names). A Korean dev reads these faster in English than force-translated.
- Preserve any code or inline snippets verbatim

English: ${englishText}

Respond with ONLY the Korean translation, no explanations.`;
}
```

> 직접 문자열 보간(placeholder 치환 아님)을 쓰는 이유: 단일 프롬프트라 `{INPUT}` 치환 실패(무음 버그)를 피함.

### 5.1.1 `lib/ai/gemini.ts` — 읽기 전용 온도 키 추가 (순수 additive)

`STYLE_TEMPERATURES`에 `"reading"` 키 **한 줄만 추가**. 기존 키(값·`?? 0.3` 폴백)는 손대지 않는다 → 기존 스타일 온도 회귀 불가.

```ts
const STYLE_TEMPERATURES: Record<string, number> = {
  "technical-doc": 0.1,
  "formal-work": 0.2,
  "casual-work": 0.3,
  "very-casual": 0.4,
  reading: 0.3, // F11: EN→KO 읽기 — 자연스러운 한국어(직역 0.1은 프롬프트의 "natural Korean"과 상충). 독립 튜닝.
};
```

> 왜 스타일 키(`"technical-doc"`)를 재사용하지 않나: 온도 하나 얻으려 스타일 키를 오버로딩하면 훗날 그 키를 재튜닝할 때 읽기 온도가 조용히 바뀌는 **숨은 결합**이 생긴다. 전용 키는 additive라 무회귀이면서 의미가 명확하다. ("gemini.ts는 성역"을 과적용하지 않는다 — 추가는 회귀가 아니다.)

### 5.2 `app/api/read/route.ts` — 신규 라우트

`/api/translate`의 스트리밍 구조를 참고하되 **캐시·settings로드·examples·finalizeTranslation·recordEdgeEmbedding·ctx.waitUntil을 전부 제거**한 얇은 버전. `ctx`는 쓰지 않으므로 `env`만 구조분해.

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { streamGeminiText, cleanGeminiOutput } from "@/lib/ai/gemini";
import { buildReadingPrompt } from "@/lib/prompts";
import { encodeStreamEvent, type StreamEvent } from "@/lib/stream-protocol";

// F11: English → Korean reading mode. EPHEMERAL by design — NO cache, NO
// persistence, NO embedding, NO TM/few-shot. This keeps the KO-centric storage/
// cache/TM machinery completely untouched (see docs/F11-reading-mode-design.md,
// decision C). Reuses the W7 NDJSON streaming protocol as-is (decision E/F).

// Reading has no user-facing style; use the DEDICATED "reading" temperature key
// added to STYLE_TEMPERATURES (§5.1.1) — 0.3, independently tunable. NOT a KO→EN
// style key (avoids hidden coupling to their tuning).
const READING_STYLE = "reading";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { englishText?: string; model?: string };
    const resolvedModel = body.model || "gemini-flash-lite";
    const rawText = body.englishText;

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return NextResponse.json({ error: "번역할 영어 텍스트가 필요합니다" }, { status: 400 });
    }
    const englishText = rawText.trim();

    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;
    if (!cfEnv.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았습니다" }, { status: 500 });
    }

    const prompt = buildReadingPrompt(englishText);
    const geminiKey = cfEnv.GEMINI_API_KEY;
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: StreamEvent) =>
          controller.enqueue(encoder.encode(encodeStreamEvent(event)));
        try {
          // korean_text is unused by the client in reading mode (§4); sent for
          // protocol shape parity only.
          send({ type: "meta", model: resolvedModel, style: "reading", korean_text: "" });

          let full = "";
          let truncated = false;
          const gen = streamGeminiText(prompt, geminiKey, resolvedModel, READING_STYLE);
          for (;;) {
            const next = await gen.next();
            if (next.done) {
              truncated = next.value.truncated;
              break;
            }
            full += next.value;
            send({ type: "delta", text: next.value });
          }

          // done.english_text carries the final cleaned OUTPUT (Korean here, §4).
          // id/created_at are empty — reading mode persists nothing.
          send({ type: "done", id: "", english_text: cleanGeminiOutput(full), truncated, created_at: "" });
          controller.close();
        } catch (err) {
          // HTTP status is already 200, so surface mid-stream failures in-band.
          send({ type: "error", message: err instanceof Error ? err.message : "번역 중 오류가 발생했습니다" });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Content-Encoding": "identity",
      },
    });
  } catch (error) {
    console.error("Reading translation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "번역 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
```

### 5.3 PR-a 테스트

**`lib/prompts.test.ts`에 추가** (기존 `describe`들은 그대로 두어 KO→EN 무회귀 증명):

```ts
import { buildReadingPrompt } from "./prompts"; // 상단 import에 추가

describe("buildReadingPrompt (F11 reading mode)", () => {
  it("substitutes the English text into the prompt", () => {
    const prompt = buildReadingPrompt("Can you take a look at this PR?");
    expect(prompt).toContain("English: Can you take a look at this PR?");
  });

  it("asks for Korean-only output", () => {
    expect(buildReadingPrompt("hi")).toContain("Respond with ONLY the Korean translation");
  });

  it("instructs to keep English technical terms in English (reverse code preservation)", () => {
    expect(buildReadingPrompt("we will deploy")).toContain("Keep English technical terms");
  });

  it("has no work-style variants (single prompt)", () => {
    // Sanity: reading prompt must not carry the KO→EN style scaffolding.
    const prompt = buildReadingPrompt("test");
    expect(prompt).not.toContain("casual but professional English");
  });
});
```

**라우트(`/api/read`) 자체는 순수 로직이 거의 없음**(입력검증 trivial + 프롬프트 빌드는 `buildReadingPrompt`로 이미 추출). `/api/translate`가 라우트 단위 유닛테스트 없이 lib 유닛 + 컴포넌트 테스트로 커버되는 것과 동일 정책. `/api/read`의 실제 스트리밍 배선은 **PR-b의 page 컴포넌트 테스트(mock `/api/read`)** + 배포 후 수동 E2E(§9)로 커버.

---

## 6. PR-b — 프론트

### 6.1 `components/TranslateForm.tsx`

**Props 추가**(둘 다 옵셔널 → 생략 시 기존 동작 = 무회귀):
```ts
interface TranslateFormProps {
  onTranslate: (text: string, model: string, style: string) => Promise<void>; // 첫 인자 = 방향별 입력 텍스트
  isLoading: boolean;
  defaultModel?: string;
  defaultStyle?: string;
  onDraftChange?: (text: string) => void;
  // F11: reading-mode direction, controlled by the page.
  direction?: "ko-en" | "en-ko";
  onDirectionChange?: (d: "ko-en" | "en-ko") => void;
}
```
컴포넌트 시그니처 기본값: `direction = "ko-en"`.

**토글 핸들러**(방향 전환 시 로컬 입력 초기화 + 상위 통보):
```ts
const handleDirectionChange = (d: "ko-en" | "en-ko") => {
  if (d === direction) return;
  setInputText("");   // 로컬 입력 초기화 (state 리네임 — 아래 note)
  onDraftChange?.("");
  onDirectionChange?.(d);
};
const isReading = direction === "en-ko";
```

**JSX 변경:**
1. `<form>` 최상단(모델/스타일 grid 위)에 토글 삽입:
```tsx
<div className="flex gap-2">
  <button
    type="button"
    onClick={() => handleDirectionChange("ko-en")}
    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
      !isReading ? "bg-gradient-primary text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`}
  >
    한국어 → 영어
  </button>
  <button
    type="button"
    onClick={() => handleDirectionChange("en-ko")}
    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
      isReading ? "bg-gradient-primary text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`}
  >
    영어 → 한국어
  </button>
</div>
```
2. 모델/스타일 grid: 읽기 모드면 스타일 숨기고 모델만(한 줄):
```tsx
<div className={isReading ? "" : "grid grid-cols-2 gap-4"}>
  <div>{/* 모델 select — 기존 그대로 */}</div>
  {!isReading && <div>{/* 스타일 select — 기존 그대로 */}</div>}
</div>
```
3. 입력 라벨/placeholder direction-aware:
```tsx
<label className="block text-sm font-medium mb-2">{isReading ? "영어 입력" : "한국어 입력"}</label>
<textarea
  ...
  placeholder={isReading
    ? "이해할 영어 메시지를 붙여넣으세요... (Enter로 번역, Shift+Enter로 줄바꿈)"
    : "번역할 텍스트를 입력하세요... (Enter로 번역, Shift+Enter로 줄바꿈)"}
  ...
/>
```
`handleSubmit`/`handleKeyDown`/제출 버튼은 **로직 불변**(아래 리네임으로 참조만 `koreanText`→`inputText`): `onTranslate(inputText, model, style)`; page가 direction으로 해석.

> **네이밍 정리(순수 내부 변경, 외부 계약 불변):** 읽기 모드에선 `koreanText` state가 *영어*를 담아 오해 소지가 있으므로 TranslateForm의 로컬 state `koreanText`→`inputText`(`setKoreanText`→`setInputText`)로 리네임. `handleSubmit`/`handleKeyDown`/`textarea`의 `value`·`onChange`·제출 버튼 `disabled`의 모든 내부 참조를 함께 바꾼다. props·placeholder·`onTranslate` 시그니처는 불변이라 테스트 무영향.

### 6.2 `app/page.tsx`

**(a) `Translation` 인터페이스에 direction 추가:**
```ts
export interface Translation {
  ...
  truncated?: boolean;
  direction?: "ko-en" | "en-ko"; // F11: undefined => ko-en (하위호환)
}
```

**(b) direction 상태 + 핸들러:**
```ts
const [direction, setDirection] = useState<"ko-en" | "en-ko">("ko-en");

const handleDirectionChange = (d: "ko-en" | "en-ko") => {
  setDirection(d);
  setResult(null);
  setTmMatches([]);
  setSelectedExampleIds(new Set());
  tmAbortRef.current?.abort(); // 진행 중 TM 조회 취소
  abortRef.current?.abort();   // ⚠️ 진행 중 본 번역 스트림도 취소. 안 하면 살아있는
                               // 리더 루프가 옛 fb.direction으로 setResult를 계속 호출해
                               // 토글/라벨(en-ko)과 결과(ko-en)가 불일치(§8 위반). AbortError는
                               // executeTranslation의 catch에서 조용히 무시되고 finally가
                               // isLoading/isStreaming을 정리함.
};
```

**(c) as-you-type 디바운스 effect를 ko-en으로 게이팅** (읽기 모드에선 TM 미발동):
```ts
useEffect(() => {
  if (direction !== "ko-en") {   // ← 추가
    setTmMatches([]);
    return;
  }
  const text = draft.trim();
  if (text.length < 3) { setTmMatches([]); return; }
  const cached = tmCacheRef.current.get(text);
  if (cached) { setTmMatches(cached); return; }
  const handle = setTimeout(() => void fetchTm(text), 500);
  return () => clearTimeout(handle);
}, [draft, direction, fetchTm]); // ← direction 추가
```

**(d) `handleTranslate`** — TM 조회를 ko-en에서만, direction을 execute로 전달:
```ts
const handleTranslate = async (text: string, model: string, style: string) => {
  if (!text.trim()) { showToast("번역할 텍스트를 입력해주세요", "error"); return; }
  if (direction === "ko-en") void fetchTm(text.trim()); // 읽기 모드는 TM 스킵
  await executeTranslation(text, model, style, direction);
};
```

**(e) `buildStreamResult`** — direction-aware. `fb`에 `text`/`direction` 포함(기존 `koreanText` → `text` 리네임):
```ts
const buildStreamResult = (
  state: StreamState,
  fb: { text: string; model: string; style: string; direction: "ko-en" | "en-ko" }
): Translation => {
  const output = state.text; // streaming: raw deltas / after done: server-cleaned
  if (fb.direction === "en-ko") {
    return {
      id: state.done?.id ?? "",         // reading: 항상 "" (일회성)
      korean_text: output,              // 한국어 출력 (불변식: korean_text=한국어 쪽)
      english_text: fb.text,            // 영어 입력
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
    korean_text: state.meta?.korean_text ?? fb.text, // 한국어 입력
    english_text: output,                            // 영어 출력
    model: state.meta?.model ?? fb.model,
    style: state.meta?.style ?? fb.style,
    is_favorite: false,
    created_at: state.done?.created_at ?? "",
    truncated: state.done?.truncated,
    direction: "ko-en",
  };
};
```

**(f) `afterComplete`** — 자동복사는 ko-en에서만, 토스트 문구 direction-aware:
```ts
const afterComplete = async (translation: Translation, direction: "ko-en" | "en-ko") => {
  // 자동복사는 한→영에서만(읽기는 붙여넣기 대상 아님). autoCopy는 자체 토스트를 띄움.
  const autoCopied = direction === "ko-en" && Boolean(settings.auto_copy);
  if (autoCopied) {
    await autoCopy(translation.english_text);
  }
  if (translation.truncated) {
    showToast("⚠️ 결과가 잘렸을 수 있습니다 (출력 길이 한도 초과)", "error");
  } else if (!autoCopied) {
    showToast("번역이 완료되었습니다", "success");
  }
};
```
> 주의: 기존 로직은 `auto_copy`면 autoCopy가 토스트를 담당하고, 아니면 완료 토스트. 위 분기는 그 의미를 유지하면서 읽기(자동복사 없음)는 항상 완료 토스트. 기존 truncated 우선순위 유지.

**(g) `executeTranslation`** — URL/바디/exampleIds를 direction으로 분기(NDJSON 소비 로직은 공유):
```ts
const executeTranslation = async (
  text: string, model: string, style: string, direction: "ko-en" | "en-ko"
) => {
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  setIsLoading(true);
  setIsStreaming(false);
  setResult(null);

  const isReading = direction === "en-ko";
  const url = isReading ? "/api/read" : "/api/translate";
  // 읽기는 예시 없음; ko-en만 opt-in TM 예시(유사도순).
  const exampleIds = isReading
    ? []
    : tmMatches.filter((m) => selectedExampleIds.has(m.id)).map((m) => m.id);
  const body = isReading
    ? JSON.stringify({ englishText: text, model })
    : JSON.stringify({ koreanText: text, model, style, exampleIds });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
    const contentType = res.headers.get("content-type") ?? "";

    // JSON = ko-en 캐시 히트 또는 (양방향) 에러. 읽기 성공은 항상 NDJSON.
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as Translation & { error?: string };
      if (!res.ok) throw new Error(data.error || "Translation failed");
      const final = { ...data, direction }; // ko-en 캐시 히트
      setResult(final);
      await afterComplete(final, direction);
      return;
    }

    if (!res.body) throw new Error("스트리밍 응답을 읽을 수 없습니다");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = createNdjsonParser();
    let state = initialStreamState();
    const fb = { text, model, style, direction };

    setIsStreaming(true);
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        state = applyStreamEvent(state, event);
        if (event.type === "error") throw new Error(state.error || "번역 중 오류가 발생했습니다");
        if (event.type === "delta") setResult(buildStreamResult(state, fb));
      }
    }

    if (state.done) {
      const final = buildStreamResult(state, fb);
      setResult(final);
      await afterComplete(final, direction);
    } else {
      showToast("응답이 중단되었습니다", "error");
    }
  } catch (error) {
    if ((error as Error)?.name === "AbortError") return;
    console.error("Translation error:", error);
    showToast(error instanceof Error ? error.message : "번역 중 오류가 발생했습니다", "error");
  } finally {
    if (abortRef.current === controller) {
      setIsStreaming(false);
      setIsLoading(false);
    }
  }
};
```
> `handleUseSimilar`(W6 재사용)는 ko-en 전용(TmPanel이 ko-en에서만 렌더)이라 변경 불필요. `direction`을 안 넣어도 `undefined`→ko-en 렌더(§4 하위호환). 원한다면 방어적으로 `direction:"ko-en"` 추가 가능.

**(h) JSX** — TmPanel을 ko-en에서만 렌더, Form에 direction props 전달:
```tsx
<TranslateForm
  onTranslate={handleTranslate}
  isLoading={isLoading}
  defaultModel={settings.default_model}
  defaultStyle={settings.default_style}
  onDraftChange={setDraft}
  direction={direction}                 // ← 추가
  onDirectionChange={handleDirectionChange} // ← 추가
/>

{direction === "ko-en" && (            // ← 게이팅
  <TmPanel
    matches={tmMatches}
    selectedIds={selectedExampleIds}
    loading={tmLoading}
    onToggleExample={toggleExample}
    onUseSimilar={handleUseSimilar}
  />
)}

{result && (
  <TranslationResult ... /> // 6.3 참고
)}
```

### 6.3 `components/TranslationResult.tsx` — direction-aware

```tsx
export function TranslationResult({ translation, streaming = false, onCopy, onToggleFavorite }: TranslationResultProps) {
  const isReading = translation.direction === "en-ko";
  const outputLabel = isReading ? "한국어 결과" : "영어 결과";
  const outputText = isReading ? translation.korean_text : translation.english_text;

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">{outputLabel}</label>
        <div className="p-4 bg-gray-50 rounded-md border border-gray-200 whitespace-pre-wrap min-h-[120px]">
          {outputText}
          {streaming && <span className="inline-block w-2 h-4 ml-0.5 align-middle bg-gray-400 animate-pulse" />}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onCopy(outputText)} className="...">📋 복사</button>
        <button
          onClick={() => onToggleFavorite(translation.id, !translation.is_favorite)}
          disabled={streaming || !translation.id}  // ← 읽기(id="")·스트리밍 중 비활성
          className="..."
        >
          {translation.is_favorite ? "⭐ 즐겨찾기됨" : "☆ 즐겨찾기"}
        </button>
      </div>
    </div>
  );
}
```
> `isReading = direction === "en-ko"` (undefined/`"ko-en"` → 영어 결과). 기존 ko-en 결과는 direction 없어도 그대로 렌더 = 무회귀.

### 6.4 PR-b 테스트

**신규 `components/TranslateForm.test.tsx`:**
- 토글 버튼 2개 렌더.
- `direction` 미지정(기본 ko-en): "한국어 입력" 라벨 + 스타일 select(옵션 "캐주얼 업무용") 존재.
- `direction="en-ko"`로 렌더: "영어 입력" 라벨, 스타일 select 부재(`queryByText("캐주얼 업무용")` null), 모델 select 존재.
- "영어 → 한국어" 클릭 → `onDirectionChange`가 `"en-ko"`로 호출. (별도로 `onDraftChange("")` 호출 검증)
- 제출(Enter) → `onTranslate(text, model, style)` 호출.

**`app/page.test.tsx`에 `describe("HomePage reading mode (F11)")` 추가:**
```ts
const READ_STREAM = [
  { type: "meta", model: "gemini-flash-lite", style: "reading", korean_text: "" },
  { type: "delta", text: "이거 " },
  { type: "delta", text: "확인해줄래?" },
  { type: "done", id: "", english_text: "이거 확인해줄래?", truncated: false, created_at: "" },
];

function mockRead() {
  return vi.fn(async (url: string) => {
    if (url === "/api/settings") return jsonResponse({ settings: { default_model: "gemini-flash-lite", default_style: "casual-work", auto_copy: 0 } });
    if (url === "/api/read") return ndjsonResponse(READ_STREAM);
    if (url === "/api/similar") return jsonResponse({ similar: [] });
    if (url === "/api/translate") return jsonResponse(TRANSLATION);
    throw new Error(`unexpected fetch: ${url}`);
  });
}
```
테스트 케이스:
1. **"translates English → Korean via /api/read"**: HomePage 렌더 → "영어 → 한국어" 버튼 클릭 → `getByRole("textbox")`에 영어 입력 → Enter → `findByText("이거 확인해줄래?")` + `findByText("한국어 결과")`.
2. **"does not fire TM lookup in reading mode"**: 위 흐름 후 `fetchMock.mock.calls.some(c => c[0] === "/api/similar")` === `false`.
3. **"does not call /api/translate in reading mode"**: `...some(c => c[0] === "/api/translate")` === `false`.
4. **"disables favorite for ephemeral reading result"**: 결과 렌더 후 즐겨찾기 버튼이 `disabled`(id="").
5. **"toggling direction aborts the in-flight translation"** (§8 정합성 방어 — ⚠️ **배선 필수**, 아래 참고):

   > **왜 특별한가:** 기존 제어형 스트림 mock들(`app/page.test.tsx` L384~)은 `vi.fn(async (url) => …)`로 **`init.signal`을 무시**한다. 게다가 W7 "clears previous" 테스트의 첫 translate 호출은 *완료된* `jsonResponse`라 abort가 no-op — **"살아있는 스트림을 abort가 멈춘다"를 검증한 선례가 없다.** signal을 배선하지 않으면 `abortRef.abort()`를 불러도 가짜 스트림이 안 죽어 루프가 옛 방향으로 재렌더 → **fix 유무와 무관하게 통과(공허)**한다. 반드시 실제 fetch처럼 signal→body `error`를 배선한다.

   - **① mock body를 signal에 배선** (실제 fetch 흉내 — abort 시 `reader.read()`가 reject):
   ```ts
   let bodyController!: ReadableStreamDefaultController<Uint8Array>;
   vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
     if (url === "/api/settings") return jsonResponse({ settings: { default_model: "gemini-flash-lite", default_style: "casual-work", auto_copy: 0 } });
     if (url === "/api/similar") return jsonResponse({ similar: [] });
     if (url === "/api/translate") {
       const body = new ReadableStream<Uint8Array>({
         start(c) {
           bodyController = c;
           // 실제 fetch: 요청 abort 시 body 스트림이 error → reader.read()가 AbortError로 reject.
           init?.signal?.addEventListener("abort", () => {
             try { c.error(new DOMException("aborted", "AbortError")); } catch {}
           });
         },
       });
       return { ok: true, body, headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "application/x-ndjson" : null) } } as unknown as Response;
     }
     throw new Error(`unexpected fetch: ${url}`);
   }));
   ```
   - **② 흐름:** ko-en 번역 시작(type "첫번째" → Enter) → `bodyController`로 `meta`+`delta("First delta")` enqueue → `findByText("First delta")` + `getByText("영어 결과")` 확인 → **"영어 → 한국어" 토글 클릭**(= `setResult(null)`+`abortRef.abort()`) → errant delta를 `try { bodyController.enqueue(delta("Should not render")) } catch {}`로 밀어넣음(fix 시엔 이미 errored라 throw → 무시) → `await new Promise((r) => setTimeout(r, 0))`.
   - **③ 판별 단언(discriminating):** `expect(screen.queryByText("영어 결과")).toBeNull()`.
     - *fix 있음:* abort→`c.error`→`read` reject→루프 종료→result는 `null` 유지→ko-en 라벨 없음 → **통과**.
     - *fix 없음:* signal 미발동→루프 생존→errant delta 처리→`buildStreamResult(fb.direction="ko-en")`가 "영어 결과" 재렌더 → 단언 실패 → **회귀 포착**.
   - ⚠️ **연결 문자열 단언 금지:** `queryByText("Should not render")`는 텍스트 노드가 `"First deltaShould not render"`로 연결돼 exact 매칭이 항상 실패(null)→공허. 반드시 **라벨(`"영어 결과"`) 부재**로 판별한다.

**(선택) `components/TranslationResult.test.tsx`:**
- `direction:"en-ko"` → "한국어 결과" 라벨 + `korean_text` 표시 + 즐겨찾기 disabled.
- `direction:"ko-en"`(또는 미지정) → "영어 결과" 라벨 + `english_text` 표시.

### 6.5 PR-b 검증 게이트
- [ ] `npm run test:run` 전량 통과 (기존 테스트 무회귀 포함).
- [ ] `npm run lint` 통과 (특히 `react-hooks/exhaustive-deps`: draft effect의 `direction`).
- [ ] `npx tsc --noEmit` (또는 프로젝트 tsc 스크립트) 통과.
- [ ] `npm run build` (OpenNext) 통과.

---

## 7. 무회귀 보장 요약

| 항목 | 보장 근거 |
|------|-----------|
| 한→영 프롬프트 글자단위 동일 | `buildTranslationPrompt`·`STYLE_PROMPTS` 미변경. `buildReadingPrompt`는 신규. |
| gemini.ts 온도 키 추가 무해 | `STYLE_TEMPERATURES`에 `"reading"` 키 *추가*만 — 기존 키 값·`?? 0.3` 폴백 불변 → 기존 스타일 온도 회귀 불가. |
| 한→영 라우트 동작 동일 | `/api/translate` 미변경. 읽기는 신규 `/api/read`. |
| W9 캐시/TM/임베딩 무영향 | 읽기는 DB·캐시·`/api/similar`·임베딩 미접촉. 마이그레이션 0. |
| 기존 결과 렌더 동일 | `direction` 미지정 → ko-en 렌더(§4 하위호환). |
| 기존 테스트 통과 | 시그니처 확장은 전부 옵셔널/추가. `fb.koreanText`→`fb.text` 리네임은 내부 캡슐화. |
| direction 미전송 시 | Form/page/route 모두 `'ko-en'` 기본 → 기존 흐름 그대로. |

---

## 8. 함정 체크리스트 (구현 시 반드시 확인)

- ⚠️ **캐시 오염 재발 금지:** 읽기 결과를 절대 DB에 쓰지 말 것. `/api/read`에 `finalizeTranslation`/`INSERT`/`recordEdgeEmbedding`가 있으면 설계 위반.
- ⚠️ **TM 유출:** 읽기 모드에서 `/api/similar`가 호출되면 안 됨. page 디바운스 effect·`handleTranslate` 양쪽 게이팅 확인(테스트 6.4-#2로 방어).
- ⚠️ **`done.english_text` 오해:** 읽기에서 이 필드엔 **한국어**가 담긴다(§4). 클라 `buildStreamResult`가 이를 `korean_text`로 매핑하는지 확인.
- ⚠️ **즐겨찾기 크래시:** 읽기 결과 id는 `""`. 즐겨찾기 버튼 `disabled={... || !translation.id}` 없으면 빈 id로 PATCH 요청 감. 반드시 비활성.
- ⚠️ **exhaustive-deps:** draft effect 의존성에 `direction` 누락 시 방향 전환 후 TM이 잘못 발동. 추가 필수.
- ℹ️ **온도:** `STYLE_TEMPERATURES`에 `"reading": 0.3` 키를 *추가*(§5.1.1). 기존 스타일 키는 손대지 말 것(additive = 무회귀). 스타일 키(`"technical-doc"` 등) 오버로딩 금지.
- ℹ️ **자동복사:** 읽기에서 자동복사 비활성(§6.2-f). 켜져 있으면 읽기 시 한국어가 클립보드에 들어가 혼란.
- ⚠️ **방향 전환 시 정리:** result/tmMatches/selectedExampleIds/textarea 초기화 + **`abortRef`·`tmAbortRef` 양쪽 abort**(§6.2b). 본 번역 abort를 빠뜨리면 스트리밍 중 토글 시 옛 방향으로 계속 렌더돼 라벨과 결과가 불일치(자동복사 시 영어가 클립보드로) — 테스트 6.4-#5로 방어.

---

## 9. PR 분할·순서·커밋

| 순서 | 내용 | 사용자 화면 영향 | 커밋 메시지(예) |
|:---:|------|------|------|
| **PR-a** | `buildReadingPrompt` + `/api/read` + prompts 유닛 테스트 + IMPROVEMENTS.md 🚧 | 없음(무회귀 선행) | `feat: F11 PR-a — EN→KO reading-mode backend (/api/read, ephemeral)` |
| **PR-b** | 방향 토글 UI + page 배선(direction 게이팅·`/api/read` 라우팅·direction-aware 렌더) + 컴포넌트/page 테스트 | 방향 토글 노출·읽기 모드 동작 | `feat: F11 PR-b — direction toggle + reading-mode UI (frontend)` |

각 PR은 `test:run`·`lint`·`tsc`·`build` 통과가 머지 조건. PR-a는 단독 배포해도 무해(무회귀 선행).

**배포 후 수동 E2E 체크리스트(PR-b 후):**
- [ ] "영어 → 한국어" 토글 → 스타일 셀렉터 사라지고 라벨/placeholder 변경.
- [ ] 영어 문단 입력·Enter → 한국어가 **스트리밍**으로 렌더(첫 토큰 즉시), 커서 표시.
- [ ] 영어 기술용어(deploy, PR, staging)가 한국어 출력에서 **영어로 보존**.
- [ ] 읽기 중 TM 패널 **미표시**, Network 탭에 `/api/similar` 호출 **없음**, `/api/read`만 호출.
- [ ] 읽기 결과에 즐겨찾기 **비활성**, 복사 버튼은 한국어 복사 동작.
- [ ] 한→영으로 되돌리면 기존 동작(스트리밍·TM 패널·즐겨찾기·자동복사) **그대로**.
- [ ] 긴 영어 입력으로 잘림 경고(truncated) 토스트 확인.

---

## 10. 범위 밖 / 의도적 보류 (❄️)

- **읽기 히스토리/캐시:** 읽기 결과를 저장·재사용하려면 `direction` 컬럼 + 방향별 캐시 키 + 읽기행 임베딩 스킵이 필요 → 표면·트랩 위험 증가. **지금은 일회성 유지, 필요 시 additive로 승격.**
- **읽기 모드 few-shot/개인화:** blocker는 임베딩 모델이 아니라 **코퍼스 성격**이다 — bge-m3는 이미 다국어 cross-lingual이라 영어 쿼리로 한국어 항목을 검색할 수는 있지만, 저장분이 "내가 내보낸 KO→EN" 코퍼스라 남의 영어 이해엔 무관(관련성 없음). 따라서 "다국어 모델로 바꾸면 읽기 TM이 살아난다"는 오판 금지 — **이미 다국어다.** → 미도입.
- **settings의 default_direction:** 매 로드 한→영 시작으로 충분. 요청 시 additive.
- **F12("내 영어 다듬기"):** 별도 항목. 본 설계와 독립.

---

## 11. 영향 파일 (요약)

**신규:** `app/api/read/route.ts`, `components/TranslateForm.test.tsx`, (선택) `components/TranslationResult.test.tsx`, 본 문서.
**수정:** `lib/prompts.ts`(추가만), `lib/ai/gemini.ts`(`STYLE_TEMPERATURES`에 `"reading"` 키 1줄, additive), `app/page.tsx`, `components/TranslateForm.tsx`(direction 토글 + `koreanText`→`inputText`), `components/TranslationResult.tsx`, `lib/prompts.test.ts`(추가), `app/page.test.tsx`(추가), `docs/IMPROVEMENTS.md`(F11 🚧+링크).
**미변경(중요):** `app/api/translate/route.ts`, `app/api/similar/route.ts`, `lib/cache.ts`, `lib/examples.ts`, `lib/translate-core.ts`, `lib/stream-protocol.ts`, `migrations/`.
