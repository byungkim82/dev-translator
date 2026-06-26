# W7 설계안 — 번역 결과 스트리밍 (Streaming)

> 백로그 항목 **W7** (`docs/IMPROVEMENTS.md`)의 상세 설계 문서.
> **상태:** 설계 검토 중 (구현 미착수 — **0단계 스파이크 통과가 전제**)
> **작성:** 2026-06-26
> **목표:** 번역 결과를 토큰 단위로 흘려 체감 속도 향상. 정확성은 그대로, 회귀 최소.

리서치(OpenNext/Cloudflare·Gemini·Next.js·Vitest 스트림 테스트) 기반. 출처는 마지막 절.

---

## 0. 리서치 검증 요약 (가장 중요)

| 질문 | 결론 |
|------|------|
| OpenNext가 라우트 핸들러의 `ReadableStream` 응답을 클라까지 흘리나? | **지원됨.** Cloudflare 공식 Next.js 가이드가 "Response streaming"을 🟢로 명시. `workerd`가 스트림 네이티브. 우리 `wrangler.toml`이 전제 충족(`nodejs_compat`, compat date `2024-12-01`). |
| 함정 | **점진적 전달은 실제 배포로만 검증 가능.** 로컬 `wrangler dev`/`next dev`(Miniflare)는 버퍼링 보고됨. → `Content-Encoding: identity` 헤더로 완화, 첫 페인트용 meta 라인 먼저. **WebKit은 ~1KB까지 버퍼**(meta 라인이 완화). |
| 중요한 안전망 | **버퍼링되더라도 결과는 정확함** — 클라 리더 루프는 "한 번에 다 도착"해도 동일하게 처리. 즉 최악의 경우 *애니메이션이 안 될 뿐, 깨지지 않음.* |
| Gemini 형식 | `streamGenerateContent?alt=sse` → `data: {json}\n\n`. delta는 `candidates[0].content.parts[0].text`, `finishReason`(STOP/MAX_TOKENS)은 **마지막 청크**. `alt=sse` 없으면 스트리밍 안 됨. |
| Vitest 테스트 | `ReadableStream`/`TextDecoder`/`TextEncoder`/`Response`/`fetch` 모두 **우리 vitest+jsdom(Node 22)에서 네이티브 사용 가능**(실측 확인). → 스트리밍 서버·클라 로직 모두 테스트 가능. |

**→ 0단계 스파이크(아래)로 "프로덕션에서 진짜 점진 전달되는가"를 먼저 확인하고, 안 되면(버퍼링만 되면) W7은 체감 이득이 없으니 보류 결정.**

---

## 1. 아키텍처 & 와이어 프로토콜

**프레이밍: NDJSON**(줄 단위 JSON). 메타데이터와 텍스트 delta를 한 스트림에 깔끔히 실음. SSE 재방출보다 단순(클라가 `EventSource` 못 씀 — POST라서).

```
{"type":"meta","model":"...","style":"...","korean_text":"..."}      ← 먼저(첫 페인트)
{"type":"delta","text":"Could "}                                     ← 토큰 조각들
{"type":"delta","text":"you take a look?"}
{"type":"done","id":"...","english_text":"...","truncated":false,"created_at":"..."}   ← 마지막
{"type":"error","message":"..."}                                     ← (스트림 중 에러 시)
```

**경로별 응답:**
- **캐시 히트(W9)** → 스트리밍 아님. 기존처럼 `NextResponse.json({...cached:true})`. (Gemini 호출 없음)
- **스트림 전 에러**(입력 무효/키 없음/4xx·5xx) → `NextResponse.json({error}, {status})`.
- **신규 번역** → 위 NDJSON 스트림.
- **스트림 중 Gemini 에러** → HTTP 상태는 이미 200이라 바꿀 수 없음 → 인밴드 `{"type":"error"}` 라인.

클라이언트는 **Content-Type으로 분기**: `application/json`(캐시·에러) vs `application/x-ndjson`(스트림). 두 경로 모두 같은 "결과 상태"로 수렴.

**DB INSERT 타이밍:** 마지막 delta 후, `done` 전에 스트림 `start()` 안에서 `await`. (request 컨텍스트가 살아있어 보장됨. `waitUntil` 아님 — `id`를 `done`에 실어야 하므로.)

---

## 2. 엔드포인트 전략 — *미결정 ① (제 추천 포함)*

| 안 | 내용 | 장 | 단 |
|----|------|----|----|
| **A (추천)** | `/api/translate`를 그대로 두되, **신규 번역 분기만 스트리밍**. 캐시 히트는 JSON 유지. 공유 로직은 테스트되는 헬퍼(`prepareTranslation`/`finalizeTranslation`)로 추출해 중복 없음. | 엔드포인트 1개·중복 없음·버퍼링 degrade로도 정확. 헬퍼 추출이 *새 테스트 커버리지*를 더함. | 잘 도는 fresh 경로를 수정(회귀 표면). |
| B | 새 `/api/translate/stream` 추가, `/api/translate`는 **완전 무수정** 폴백. 클라가 스트림 실패 시 폴백. | 기존 경로 0 수정·런타임 폴백. | 코드 더 많음·2 엔드포인트 유지. "버퍼링=여전히 정확"이라 폴백 가치 낮음. |

**추천: A.** "버퍼링되어도 결과는 정확"이라 런타임 폴백(B)의 이득이 작고, 헬퍼 추출로 fresh 경로 로직이 *오히려 테스트로 덮임*. 단, fresh 경로 수정이 부담되면 B도 합리적 — **확정 필요.**

---

## 3. 구현 단계 (단계마다 테스트 동반)

### 0단계 · 스파이크 (배포로만 검증 — go/no-go)
임시 라우트 추가 → 배포 → `curl -N`로 *점진* 전달 확인 → 삭제.
```ts
// app/api/_streamtest/route.ts (검증 후 삭제)
export async function GET() {
  const enc = new TextEncoder();
  const stream = new ReadableStream({ async start(c) {
    for (let i = 0; i < 5; i++) { c.enqueue(enc.encode(`chunk ${i} @ ${Date.now()}\n`)); await new Promise(r => setTimeout(r, 500)); }
    c.close();
  }});
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Encoding": "identity" } });
}
```
`curl -N https://<worker>/api/_streamtest` → 500ms 간격으로 한 줄씩 = 성공. 한 번에 = 버퍼링(=W7 이득 없음, 재고).

### 1단계 · 순수 lib + 단위 테스트 (배선 없음)
- `lib/ai/sse.ts` — **분할 청크 안전 SSE 파서**(상태 머신: `push(chunk) => 완성된 JSON 객체들`). + `extractDelta(chunk) => { text?, finishReason? }`.
- `lib/stream-protocol.ts` — NDJSON **인코드**(서버: `meta/delta/done/error` 라인) + **디코드**(클라: 라인→이벤트) + **리듀서** `applyStreamEvent(state, event) => state`.
- (이 단계는 fetch/DB 없이 전부 순수 → 빡센 단위 테스트)

### 2단계 · Gemini 스트리밍 + 라우트 + 헬퍼
- `lib/ai/gemini.ts`에 `streamGeminiText(prompt, apiKey, model, style, fetchImpl=fetch)` — `streamGenerateContent?alt=sse` 호출 → 1단계 파서로 delta를 async-yield, 최종 `{ truncated }`. (fetch 주입 → mock 가능)
- `lib/translate-core.ts`(신규) — `prepareTranslation(db, env, input)`(캐시 조회·설정·임베딩·예시·프롬프트) / `finalizeTranslation(db, row)`(INSERT). `cache.ts`처럼 의존성 주입.
- `app/api/translate/route.ts` — fresh 분기를 NDJSON `ReadableStream`으로. 캐시/에러는 JSON 유지.

### 3단계 · 클라이언트 + 컴포넌트 테스트
- `app/page.tsx` — `executeTranslation`을 스트리밍 소비로: `res.body.getReader()` + `TextDecoder` + 라인 버퍼 + `applyStreamEvent`. **함수형 업데이트**(`setResult(prev => …)`)로 delta 누적.
- `components/TranslationResult.tsx` — 부분 텍스트 + 스트리밍 인디케이터(커서/“…”). **즐겨찾기·자동복사·잘림경고는 `done` 후**(id·전체텍스트 확보 후) 동작.
- Content-Type 분기로 캐시 히트·에러 경로 유지.

### 4단계 · 수동 검증 (배포 후)
실제 Gemini 스트리밍, 점진 페인트, 긴 출력, 잘림(MAX_TOKENS), 스트림 중 에러, 캐시 히트, 즐겨찾기/자동복사 타이밍.

---

## 4. 테스트 매트릭스 (커버리지 계획)

| 레이어 | 항목 | 테스트 종류 |
|--------|------|-------------|
| `lib/ai/sse.ts` | 분할 청크(JSON 중간/토큰 중간 분할), 한 read에 2이벤트, `finishReason`만 있고 text 없음 | **단위(node)** |
| `lib/ai/sse.ts` | `extractDelta`: text/빈 parts/MAX_TOKENS | **단위(node)** |
| `lib/stream-protocol.ts` | encode/decode 왕복, `applyStreamEvent` 리듀서(meta→delta×N→done, error) | **단위(node)** |
| `lib/ai/gemini.ts` | `streamGeminiText`: mock fetch가 가짜 SSE `ReadableStream` 반환 → delta 누적·truncated | **단위(node, fetch mock)** |
| `lib/translate-core.ts` | `prepareTranslation`(캐시 히트/미스·예시·프롬프트), `finalizeTranslation`(INSERT 바인딩) | **단위(node, 가짜 DB)** |
| `app/page.tsx` | 가짜 NDJSON `Response`로 **점진 렌더**("Hello"→"Hello world"), 최종 상태, 잘림 토스트, 인밴드 error, 캐시-히트 JSON 경로, 유사 재사용, 자동복사 타이밍 | **컴포넌트(jsdom)** |
| OpenNext 점진 전달 | 0단계 스파이크 `curl -N` | **수동(배포)** |
| 실제 Gemini E2E | 긴 번역·잘림·에러 | **수동(배포)** |

핵심: **분할 청크 파서**(SSE 버그가 숨는 곳)와 **클라 점진 렌더**까지 자동 테스트로 덮음. 자동으로 못 덮는 건 *OpenNext 점진 전달*과 *실제 Gemini*뿐 → 명시적 수동 단계.

---

## 5. 미결정 사항 (확정 필요)

| # | 결정 | 추천 |
|---|------|------|
| ① | 엔드포인트 전략 | **A: `/api/translate` fresh 분기만 스트리밍 + 헬퍼 추출** (§2) |
| ② | `Content-Encoding: identity` 헤더 | **포함** (버퍼링 완화, 무해) |
| ③ | 스트리밍 중 즐겨찾기 버튼 | **`done` 전까지 비활성**(id 없음) |
| ④ | `AbortController`로 진행 중 번역 취소 | 넣기(빠른 재요청 시 누수 방지) — 작음 |
| ⑤ | 스트리밍 인디케이터 UI | 부분 텍스트 끝 깜빡이는 커서(간단) |

---

## 6. 위험 & 롤백
- **최대 위험**: OpenNext가 프로덕션에서 버퍼링 → 0단계 스파이크로 *먼저* 판별(코드 더 안 쌓고 멈춤).
- **회귀**: 캐시 히트·에러 경로 무수정. fresh 경로는 헬퍼 추출(테스트됨) + "버퍼링되어도 정확" 안전망.
- **롤백**: 스트리밍 분기만 되돌리면 기존 JSON 응답으로 복귀(헬퍼는 재사용).
- 기존 기능(Q1 글로서리·P14 예시·Q6 잘림감지·W9 캐시)은 `prepare`에서 그대로 적용, 잘림은 마지막 청크의 `finishReason`으로 판정.

---

## 7. 출처
- [Cloudflare Workers Next.js 가이드 (Response streaming 🟢)](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare Streams 런타임 API](https://developers.cloudflare.com/workers/runtime-apis/streams/)
- [OpenNext Cloudflare](https://opennext.js.org/cloudflare)
- [Gemini generate-content API](https://ai.google.dev/api/generate-content) · [Gemini Streaming REST 쿡북](https://github.com/google-gemini/cookbook/blob/main/quickstarts/rest/Streaming_REST.ipynb)
- [Next.js 스트리밍 가이드](https://nextjs.org/docs/app/guides/streaming)
- [Simon Willison — How streaming LLM APIs work](https://til.simonwillison.net/llms/streaming-llm-apis)
- [Miniflare 버퍼링 이슈 workers-sdk#8004](https://github.com/cloudflare/workers-sdk/issues/8004)
