# Dev Translator — 개선 트래킹 (Improvement Backlog)

> 업무용 한↔영 번역 도구의 개선 아이디어를 추적하는 살아있는 문서입니다.
> 핵심 가치 기준: **"번역 → Slack 붙여넣기 10초 이내, 수작업 교정 최소화"**
>
> **마지막 업데이트:** 2026-06-25
> **사용법:** 항목을 진행할 때 상태를 갱신하고, 커밋 메시지/대화에서 `Q1`, `W6` 같은 ID로 참조하세요. 완료 항목은 아래 [완료 로그](#완료-로그)로 옮깁니다.
> **작업 규칙:** 모든 개선은 가능한 한 **테스트 커버리지와 함께** 진행합니다 (Vitest 기반 = T18). 순수 로직 → 유닛 테스트, UI → 컴포넌트 테스트, API 라우트 → Workers 풀, 외부 API → `fetch` 모킹.

---

## 범례 (Legend)

**상태(Status):** 🔲 To Do · 🚧 In Progress · ✅ Done · ❄️ Deferred · ❌ Won't Do

**우선순위(Priority):** 🔴 High · 🟡 Medium · 🟢 Low

**작업량(Effort):** S (반나절) · M (1~2일) · L (3일+)

---

## 대시보드 (한눈에 보기)

| ID | 항목 | 분류 | 우선 | 작업량 | 상태 |
|----|------|------|:---:|:---:|:---:|
| B1 | `auto_copy` 설정이 동작하지 않음 | Bug | 🔴 | S | ✅ |
| B2 | DB에 잘못된 모델명 저장 | Bug | 🟡 | S | ✅ |
| Q1 | 용어집(Glossary) — 간단 버전(자유 텍스트 지침) | 품질 | 🔴 | M | ✅ |
| Q2 | 코드/영어 혼용 입력 보존 | 품질 | 🔴 | S | ✅ |
| Q3 | 답장 맥락(원문 메시지) 입력 | 품질 | 🟡 | M | 🔲 |
| Q4 | 번역 후 미세 조정(refine/regenerate) | 품질 | 🟡 | M | 🔲 |
| Q5 | 대안 2~3개 동시 제시 | 품질 | 🟢 | M | 🔲 |
| Q6 | 출력 길이 상한 8192 + 잘림 감지 경고 | 품질 | 🟡 | S | ✅ |
| W6 | 유사 검색 논블로킹/병렬화 | 워크플로우 | 🔴 | M | ✅ |
| W7 | 스트리밍 출력 | 워크플로우 | 🔴 | M | ✅ |
| W8 | 자동 복사 + 토스트 (B1 연계) | 워크플로우 | 🔴 | S | ✅ |
| W9 | 정확 일치 캐시 | 워크플로우 | 🟡 | S | ✅ |
| W10 | 브라우저 확장 / 전역 단축키 | 워크플로우 | 🟢 | L | 🔲 |
| F11 | 영어 → 한국어 (읽기 모드) | 기능 | 🔴 | M | 🔲 |
| F12 | "내 영어 다듬기" 모드 | 기능 | 🟢 | M | 🔲 |
| F13 | 자주 쓰는 템플릿/스니펫 | 기능 | 🟢 | M | 🔲 |
| P14 | 내 과거 번역을 few-shot으로 재활용 | 개인화 | 🔴 | L | ✅ |
| P15 | 인라인 편집 + 교정 학습 | 개인화 | 🟡 | M | 🔲 |
| P16 | As-you-type 번역 메모리 (bge-m3 + 옵트인 few-shot; P14/W6 통합) | 개인화 | 🔴 | L | ✅ |
| T16 | 유사 검색을 Cloudflare Vectorize로 이전 | 기술 | 🟡 | L | 🔲 |
| T17 | Gemini 호출 타임아웃/재시도 | 기술 | 🟡 | S | 🔲 |
| T18 | 테스트 기반 구축 (Vitest + 순수 함수 유닛 테스트) | 기술 | 🟡 | M | ✅ |
| T19 | GitHub Actions 액션 버전 업그레이드 (checkout/setup-node v4→v5) | 기술 | 🟢 | S | 🔲 |

---

## 🐞 버그 (Bugs)

### B1 · `auto_copy` 설정이 동작하지 않음 — 🔴 S — ✅
`settings`에 `auto_copy`가 로드되지만(`app/page.tsx:41-45`) 번역 완료 흐름 `executeTranslation`에서 전혀 사용되지 않아 자동 복사 설정이 죽어 있던 문제. **W8과 함께 수정 완료** — 상세는 W8 참고.

### B2 · DB에 잘못된 모델명 저장 — 🟡 S
`app/api/translate/route.ts:63`에서 `model || "gemini-flash"`로 저장하지만 실제 기본 키는 `"gemini-flash-lite"`. 기본 모델로 번역 시 DB에 존재하지 않는 `gemini-flash`가 기록됨(통계/필터 왜곡 가능).
**고치기:** fallback을 `"gemini-flash-lite"`로 통일.

---

## 🎯 번역 품질 (Quality) — 수작업 교정 최소화 직결

### Q1 · 용어집(Glossary) — 🔴 M — ✅ (간단 버전)
회사 용어·고유명사의 반복 교정 제거. **사용자 우려(복잡도·기존 기능 회귀 위험·이해 가능성)를 반영해 "간단 버전"으로 구현**: 새 테이블/한국어 매칭/캐시 변경 없이, 설정의 자유 텍스트 '용어/번역 지침' 필드를 프롬프트에 그대로 덧붙임. 기존 사용자 컨텍스트 주입과 동일 패턴. **비우면 프롬프트가 기존과 글자 단위로 동일(무회귀).**
**완료 범위:** `migrations/0004_add_glossary_to_settings.sql`(settings에 `glossary` 컬럼), `lib/prompts.ts`의 `buildGlossaryLine` + `buildTranslationPrompt` 4번째 인자 주입, `app/api/translate/route.ts`(로드·전달), `app/api/settings/route.ts`(저장), `app/settings/page.tsx`(텍스트영역 UI).
**테스트:** `lib/prompts.test.ts` — 주입/생략·빈 입력 no-op (유닛 4개).
**알려진 제약:** 지침을 수정해도 W9 캐시에 이미 있는 *동일 입력*은 옛 결과 반환(새 입력엔 즉시 반영) → Q4의 "새로 번역"으로 우회 예정.
**📐 전체 설계(보류):** [`docs/Q1-glossary-design.md`](./Q1-glossary-design.md) — 테이블 + 한국어 조사 매칭 + 캐시 시그니처 + CRUD UI. 용어가 수백 개 규모로 커지면 그때 승격.

### Q2 · 코드/영어 혼용 입력 보존 — 🔴 S — ✅
"이 PR을 merge 했고 staging에 deploy 했어" 같은 입력에서 `merge`/`deploy`/함수명/변수명을 그대로 유지하도록 프롬프트에 명시.
**완료 범위:** `lib/prompts.ts`에 `CODE_PRESERVATION_RULE` 상수 추가, `buildTranslationPrompt`가 **모든 스타일(+unknown fallback)** 에 공통 주입(템플릿 4개를 건드리지 않고 한 곳에서 DRY하게). 입력에 이미 등장하는 영어 기술용어/식별자/명령어/제품명을 그대로 두도록 지시.
**테스트:** `lib/prompts.test.ts` — 4개 스타일 + unknown fallback 모두에 규칙이 주입되는지 검증(유닛 2개).

### Q3 · 답장 맥락(원문 메시지) 입력 — 🟡 M
"내가 답하는 원문 메시지" 입력란 추가 → 대명사·시제·톤 정확도 향상.
**관련 코드:** `components/TranslateForm.tsx`(입력란), `lib/prompts.ts`(맥락 주입), `app/api/translate/route.ts`(파라미터).

### Q4 · 번역 후 미세 조정(refine / regenerate) — 🟡 M
결과 영역에 "더 짧게 / 더 정중하게 / 덜 격식있게 / 다시 생성" 버튼. 재입력 없이 한 번 더 돌려 완성도 향상.
**관련 코드:** `components/TranslationResult.tsx`, 새 refine 엔드포인트 또는 `translate` 확장.
**W9 연계(여기서 함께 처리):** 캐시 히트 가시화 — 응답의 `cached` 마커로 "이전 번역 재사용" 뱃지 표시 + "새로 번역" 버튼이 `forceFresh`로 W9 캐시를 건너뛰게. 같은 모델+스타일 강제 재번역 경로를 제공해 캐시가 워크플로우를 가두지 않게 함.

### Q5 · 대안 2~3개 동시 제시 — 🟢 M
한 번 호출로 변형 여러 개를 받아 골라 쓰기. 애매한 뉘앙스를 교정 대신 선택으로 해결.
**관련 코드:** `lib/ai/gemini.ts`(다중 후보), `components/TranslationResult.tsx`(선택 UI).

### Q6 · 출력 길이 상한 8192 + 잘림 감지 경고 — 🟡 S — ✅
`lib/ai/gemini.ts`의 `maxOutputTokens`가 2048이라 긴 번역이 **조용히 잘렸음**(긴 문서·장문 메시지). 게다가 `finishReason`을 안 봐서 잘려도 무경고.
**완료 범위:** 상한을 **8192**로 상향(번역은 출력≈입력 길이라 아주 긴 메시지도 안 잘림). `callGemini`가 `{ text, truncated }` 반환 — `finishReason === "MAX_TOKENS"`이면 `truncated`. translate 라우트가 응답에 `truncated` 노출, UI는 잘림 시 경고 토스트("결과가 잘렸을 수 있습니다"). categorize 라우트도 새 반환형에 맞춤.
**테스트:** `lib/ai/gemini.test.ts`의 `isTruncated`(MAX_TOKENS/STOP/없음) + `app/page.test.tsx` 경고 토스트 컴포넌트 테스트.

---

## ⚡ 속도 & 워크플로우 (Workflow) — 핵심 가치 = 10초

### W6 · 유사 검색 논블로킹/병렬화 — 🔴 M — ✅
이전엔 `handleTranslate`가 **모든 번역마다** `/api/similar`를 먼저 호출하고 0.85 초과가 있으면 **모달로 흐름을 끊어** 선택을 강요 → 매번 지연 + 방해.
**완료 범위:** `app/page.tsx`를 비차단 흐름으로 — 번역을 **즉시 시작**하고 `/api/similar`는 병렬(`void fetchSimilar`)로 돌려, 결과가 나오면 그 아래 `components/SimilarSuggestions.tsx`(신규) 카드로 표시("이걸로 교체"로 재사용). 차단 모달 `SimilarModal`·`showSimilarModal`·`pendingTranslation`·`handleTranslateNew` 제거(파일 삭제). 이제 번역은 끊김 없는 한 단계.
**테스트:** `app/page.test.tsx`에 W6 컴포넌트 테스트 2개(제안 표시·재사용 시 결과 교체); 기존 자동복사 테스트도 통과.

### W7 · 스트리밍 출력 — 🔴 M
Gemini를 `streamGenerateContent`로 바꿔 토큰 단위 출력 → 체감 속도 대폭 향상. 현재는 완료까지 빈 화면 대기(`lib/ai/gemini.ts`는 `generateContent` 사용).
**📐 설계안:** [`docs/W7-streaming-design.md`](./W7-streaming-design.md) — 리서치 검증(OpenNext 스트리밍 **지원**, 단 점진 전달은 배포로만 확인). NDJSON 프로토콜·분할청크 SSE 파서·라우트/클라 패턴·**전체 테스트 매트릭스**(SSE 파서~클라 점진 렌더까지 자동, OpenNext/실 Gemini만 수동) 포함. **0단계 스파이크(배포 `curl -N`) 통과가 구현 전제.** **미결정 5건**(엔드포인트 전략 등).
**관련 코드:** `lib/ai/sse.ts`·`lib/stream-protocol.ts`(신규), `lib/ai/gemini.ts`(`streamGeminiText`), `lib/translate-core.ts`(신규: prepare/finalize), `app/api/translate/route.ts`, `app/page.tsx`·`components/TranslationResult.tsx`.
**진행 상황:** ✅ **코드 완료** (미결정 5건 추천대로 확정).
- **0단계 스파이크 ✅** — 프로덕션 배포에서 점진 전달 실측 확인(언더스코어 폴더 404 이슈도 해결).
- **1단계**(`25cf22c`): `lib/ai/sse.ts`(분할청크 SSE 파서+`extractDelta`) + `lib/stream-protocol.ts`(NDJSON 인코드/디코드+`applyStreamEvent`) + 유닛 19개. 스파이크 라우트 삭제.
- **2단계**(`732fabf`): `streamGeminiText`(주입 fetch로 단위 테스트) + `finalizeTranslation`(주입 DB로 테스트) + 라우트 fresh 분기를 NDJSON 스트림으로. 캐시/에러는 JSON 무수정. *과설계 지양: `prepareTranslation`은 재사용처 없어 미추출.*
- **3단계**(`4508678`): `page.tsx`가 content-type 분기로 NDJSON 점진 소비, `TranslationResult` 커서+`done` 전 즐겨찾기 비활성, `AbortController` 취소. 컴포넌트 테스트(점진 렌더·자동복사·잘림·인밴드 에러) + 기존 JSON 경로 테스트. **`npm run build` 통과.**
- **4단계(남음): 배포 후 수동 E2E 검증** — 실제 Gemini 스트리밍/긴 출력/잘림/에러를 눈으로 확인. (스파이크로 메커니즘은 이미 검증됨.)

### W8 · 자동 복사 + 토스트 — 🔴 S — ✅
B1 수정 포함. 번역이 끝나면 바로 클립보드에 들어가 붙여넣기만 하면 되게.
**완료 범위:** `app/page.tsx`에 `autoCopy()` 헬퍼 추가 → `executeTranslation` 성공 시와 `handleUseSimilar`(기존 번역 재사용) 시 `settings.auto_copy`가 켜져 있으면 결과를 클립보드에 자동 복사 + "자동 복사됨" 토스트, 실패 시 안내 토스트로 폴백.
**테스트:** `app/page.test.tsx` 컴포넌트 테스트(jsdom + React Testing Library, `fetch`/clipboard 모킹) — auto_copy ON이면 클립보드 호출·OFF면 미호출 검증. 이 작업으로 **컴포넌트 테스트 환경도 함께 구축**됨(`@vitejs/plugin-react`, jsdom, RTL).
**알려진 제약:** `navigator.clipboard.writeText`는 비동기 fetch 이후 호출돼 일부 브라우저(특히 Safari)에서 사용자 제스처 밖이라 차단될 수 있음 → 그 경우 폴백 토스트가 뜨고 수동 복사 버튼으로 처리.

### W9 · 정확 일치 캐시 — 🟡 S — ✅
동일 입력은 DB에서 즉시 반환(API 호출·임베딩 비용 0, 중복 행 없음). 번역 전에 정확 일치 조회.
**완료 범위:**
- `lib/cache.ts` — `normalizeKoreanInput`(trim), `findCachedTranslation(db, text, style, model)`. DB를 최소 인터페이스(`CacheDB`)로 주입받아 가짜 DB로 단위 테스트 가능.
- 캐시 키 = **정규화된 텍스트 + style + model**. 모델/스타일 중 하나만 바뀌어도 미스 → 새 번역(저비용→고품질 재요청 워크플로우 보존).
- `app/api/translate/route.ts`가 Gemini 호출 *전에* 조회, 히트 시 저장된 번역을 `cached: true`와 함께 반환. (style fallback도 `resolvedStyle`로 통일)
- 응답에 `cached` 마커 추가(미스 시 `false`) — Q4 가시화의 신호로 사용.
**테스트:** `lib/cache.test.ts` — 정규화(앞뒤 trim·내부 유지·공백전용→빈문자), 바인딩 인자(trim 적용), 히트/미스 반환. (유닛 6개)
**의도적 보류:** 같은 모델+스타일로 *일부러 다시* 돌릴 때를 위한 **가시화(캐시 뱃지 + "새로 번역"/`forceFresh` 우회)는 Q4에서** 처리. 그 전까지는 동일 파라미터 재요청이 조용히 캐시를 반환함(설계상 합의됨). → Q4 참고

### W10 · 브라우저 확장 / 전역 단축키 — 🟢 L
앱 탭 전환 없이 어디서든 번역. "10초"를 실제로 푸는 가장 큰 레버지만 작업량 큼.
**관련 코드:** 신규 확장 프로젝트 + 기존 API 재사용.

---

## ✨ 새 기능 (Features)

### F11 · 영어 → 한국어 (읽기 모드) — 🔴 M
워크플로우의 나머지 절반. 들어오는 영어 Slack 메시지를 빠르게 이해. 현재 단방향이라 절반만 커버.
**관련 코드:** `lib/prompts.ts`(역방향 프롬프트), `components/TranslateForm.tsx`(방향 토글), `app/api/translate/route.ts`.

### F12 · "내 영어 다듬기" 모드 — 🟢 M
직접 쓴 어색한 영어를 번역이 아니라 교정 + 뉘앙스 피드백(학습 효과).
**관련 코드:** `lib/prompts.ts`, 모드 선택 UI.

### F13 · 자주 쓰는 템플릿/스니펫 — 🟢 M
스탠드업 업데이트, PR 리뷰 요청, OOO/휴가 알림 등 반복 메시지 원클릭.
**관련 코드:** 신규 `migrations/`(snippets), settings/메인 UI.

---

## 🧠 개인화 / 학습 (Personalization)

### P14 · 내 과거 번역을 few-shot으로 재활용 — 🔴 L
현재 프롬프트 예시는 고정·일반적(`lib/prompts.ts`). 즐겨찾기/채택 번역을 임베딩으로 검색해 프롬프트 예시로 주입 → 쓸수록 내 스타일에 수렴(교정 감소). T16/P15와 시너지.
**📐 설계안:** [`docs/P14-personalized-examples-design.md`](./P14-personalized-examples-design.md) — 대부분 기존 인프라(임베딩·`lib/similarity.ts`·주입 자리) 재사용이라 신규 표면 최소. 콜드스타트/노키 시 정적 예시로 폴백(= no-op, 무회귀). **구현 전 미결정 5건**(예시 출처/개수 K/유사도 임계값/주입 방식/시그니처) 확정 필요.
**관련 코드:** `lib/examples.ts`(신규: 선택/포맷), `lib/prompts.ts`(주입), `lib/similarity.ts`(재사용), `app/api/translate/route.ts`(임베딩 선계산+후보 조회).
**진행 상황:** ✅ 결정 5건 전부 추천대로. **PR1**(`ed54b49`) — `lib/examples.ts`(`selectFewShotExamples` 즐겨찾기·임계값 0.75·K=3 + `buildExamplesLine`) + `buildTranslationPrompt` 5번째 인자 주입 + 유닛 테스트 8개. **PR2**(`7e52f3e`) — 라우트 배선: 입력 임베딩 *번역 전* 1회 계산(검색+저장 공유), 즐겨찾기 후보 조회, 예시 선택·주입. **활성화 완료.** 폴백(키 없음/유사 없음 → 정적 예시)로 무회귀.
**알려진 제약:** W9 캐시 히트는 P14 적용 안 됨(저장본 반환) — 동일 입력 재번역 시 늘어난 예시 미반영. Q4 "새로 번역"으로 우회 예정.

### P15 · 인라인 편집 + 교정 학습 — 🟡 M
결과를 복사 전 인라인 편집 가능하게 하고, 편집분을 "교정 신호"로 저장 → P14 학습 데이터로 활용.
**관련 코드:** `components/TranslationResult.tsx`, `app/api/history/route.ts`, schema(편집 추적 컬럼).

### P16 · As-you-type 번역 메모리 (TM) — 🔴 L
입력하는 동안(디바운스) 즐겨찾기 코퍼스에서 비슷한 과거 번역을 찾아 보여주고, 강한 매치는 **옵트인으로 few-shot 주입**. 번역은 임베딩에 안 막힘, 임베딩은 백그라운드 기록. 전문 번역 도구의 **Translation Memory** 패턴 + LLM few-shot + 엣지 임베딩. **P14(항상 발동) 대체 · W6 흡수 · T16 동기 대체**.
**📐 설계안:** [`docs/TM-as-you-type-design.md`](./TM-as-you-type-design.md) — 리서치 기반. 핵심 판정: **bge-m3(Workers AI 엣지)가 한국어에서 OpenAI보다 우수+저렴**(MIRACL-Ko 69.9 vs 63.9), 타이핑-중은 멈춤-디바운스(~500ms), 단일사용자라 프라이버시 무이슈(OpenAI 제거가 이득). 단계: **P1**(bge-m3 전환+임베딩 핫패스 분리=지연 해결) → **P2**(as-you-type 패널) → **P3**(선택: 인-브라우저). **미결정 5건**(전환/시작점/P14 처리 등).
**관련 코드:** `wrangler.toml`(`[ai]`), `lib/ai/embedding-edge.ts`·`app/api/tm/route.ts`(신규), `app/api/translate/route.ts`·`app/api/similar/route.ts`, `components/TranslateForm.tsx`, `migrations/0005_*`.
**진행 상황:** ✅ **Phase 1·2 완료 + 프로덕션 배포·QA 통과 (2026-06-30)** — bge-m3 전환 + 핫패스 임베딩 제거(~1.3s 블록 해소) + as-you-type TM 패널 + 옵트인 few-shot. Phase 3(인-브라우저)는 의도적 보류.
- **Phase 1a(스팟체크)**: `[ai]` 바인딩·`env.AI`·`lib/ai/embedding-edge.ts` 추가, 임시 라우트로 한국어 품질·지연 실측 후 삭제. 확정: 모델 `bge-m3`(1024), 버전태그 `bgem3-1024`, 임계값 0.68, qwen3/OpenAI 드롭 (§8).
- **Phase 1 본작업**: ① `migrations/0005_add_embedding_version.sql`(`embedding_version`+`embedding_v2`, 기존 `embedding` 보존). ② `/api/translate` **인라인 임베딩·P14 조회 제거** → 스트림 종료·`controller.close()` 후 `ctx.waitUntil(recordEdgeEmbedding)`로 bge-m3 임베딩을 `embedding_v2`+버전에 백그라운드 저장(번역 무차단). ③ `/api/similar`·`lib/examples.ts` bge-m3·`embedding_version='bgem3-1024'` 게이팅·임계값 0.68(`embedding_v2 AS embedding`으로 `findSimilarTranslations` 무수정 재사용). ④ `lib/backfill.ts`(`backfillEmbeddingBatch`, 페이지 50, `recordEdgeEmbedding` 재사용·멱등) + 얇은 `app/api/backfill/route.ts`(배치당 1회·`remaining` 반환). ⑤ 유닛 테스트 +9(`recordEdgeEmbedding`·`backfillEmbeddingBatch`·버전/임계값 상수) = 총 96개 통과, `next build`·lint·tsc 통과.
- **Phase 1의 의도된 트레이드오프:** P14 인라인 few-shot은 잠시 내려놓음(정적 예시로 폴백=무회귀) → **Phase 2 옵트인**으로 부활(결정 ③). 버전 게이팅으로 **백필 전까지 `/api/similar`는 빈 결과**(마이그레이션 중 공간 혼합 방지, 의도됨). 배포 순서: `main` push → **CI deploy 잡이 build→마이그레이션 0005(`--remote`)→worker 배포 자동 수행**(수동 `db:migrate:prod` 불필요) → 이후 `POST /api/backfill` 반복(remaining=0까지) → 유사검색 활성. (로컬 dev만 `db:migrate:local` 수동.)
- **Phase 2 상세 설계 완료**([§11](./TM-as-you-type-design.md)): gap 5개 확정 — ① `/api/similar` 재사용(신규 라우트 불필요, 이미 `is_favorite`+`similarity` 반환) ② `TmPanel` UX(디바운스 500ms·즐겨찾기만 예시 체크) ③ `exampleIds` → `fetchExamplesByIds` id 주입(임베딩 0) ④ ⚠️W9 정합성 = `had_examples` 불리언 컬럼(0006)+예시 force-fresh ⑤ 표시·주입 단일 컷오프 0.68. PR 분할: **PR-a 백엔드(무 UI, 무회귀 선행)** → **PR-b 프론트**. 결정 A~E 사인오프(§11.8). ✅ **PR-a(백엔드) 구현 완료** — 0006 마이그레이션(`had_examples`) + `findCachedTranslation` `had_examples=0` 필터 + `fetchExamplesByIds`(id 주입, 임베딩 0) + 라우트 `exampleIds` 수용(없으면 무회귀)·예시요청 캐시 스킵. ✅ **PR-b(프론트) 구현 완료** — `TranslateForm.onDraftChange` + page 디바운스(500ms·≥3자·쿼리캐시·abort) TM 조회 + `SimilarSuggestions`→`TmPanel`(즐겨찾기 예시 체크박스·로딩/빈 상태) + 유사도순 `exampleIds` 전달. TM 조회는 타이핑·제출 양쪽 발동(캐시 dedup)이라 W6 무회귀. 테스트 총 112 · lint·tsc·`next build` 통과.
- ✅ **배포 + 프로덕션 QA 통과 (2026-06-30)** — 자동테스트로 못 잡는 **런타임 전용 위험 항목 2개 검증**: **A2 백그라운드 임베딩**(`ctx.waitUntil`이 실 Workers에서 bge-m3 벡터를 `embedding_v2`+버전에 기록) · **C 캐시 정합성 트랩**(plain→예시→plain 시 정확히 2행[plain 1+예시 1], 예시본이 plain 캐시 오염 안 함 = `had_examples` 격리 검증). 부수 검증: A1 첫 토큰 즉시(1.3s 블록 해소), B1 as-you-type 패널(강한 패러프레이즈 **83% 매치**, 컷오프 0.68 대비 여유 0.15), B3 즐겨찾기만 예시 체크박스, B4 `exampleIds` 전송. **컷오프 0.68은 실사용 며칠 후 오탐 빈도로 최종 조정**(`EDGE_SIMILARITY_THRESHOLD` 한 곳). Phase 3(인-브라우저)는 보류.

---

## 🛠 기술 / 확장성 (Technical)

### T16 · 유사 검색을 Cloudflare Vectorize로 이전 — 🟡 L
현재 매 번역마다 최대 1000행을 Worker 메모리로 로드해 1536차원 JSON을 파싱·코사인 계산(`lib/similarity.ts`, `app/api/similar/route.ts:30-36`). 데이터가 늘면 느려지고 비싸짐. Vectorize가 정석.
**관련 코드:** `wrangler.toml`(바인딩), `app/api/similar/route.ts`, `app/api/translate/route.ts`(저장 시 upsert).

### T17 · Gemini 호출 타임아웃/재시도 — 🟡 S
현재 실패 시 그대로 에러(`lib/ai/gemini.ts`). 1회 재시도 + 타임아웃으로 안정성 확보.
**관련 코드:** `lib/ai/gemini.ts`.

### T18 · 테스트 기반 구축 (Vitest + 순수 함수 유닛 테스트) — 🟡 M — ✅
변경이 동작을 깨뜨려도 잡아줄 자동 안전망이 없던 상태에서, Vitest 기반을 세우고 I/O 없는 순수 함수부터 커버.
**완료 범위:**
- Vitest 설치 + `vitest.config.ts`(node 환경, tsconfig의 `@/*` alias 미러), `npm test` / `npm run test:run` 스크립트
- 유닛 테스트 32개 (4파일): `lib/similarity.test.ts`(코사인·임계값·정렬·잘못된 임베딩 스킵), `lib/prompts.test.ts`(맥락 주입·스타일 fallback·카테고리), `lib/utils.test.ts`(토큰 추정·UUID), `lib/ai/gemini.test.ts`(따옴표/접두사 후처리)
- `lib/ai/gemini.ts`의 후처리 로직을 `cleanGeminiOutput()`로 추출해 API 호출 없이 테스트 가능하게 리팩터
**향후 확장:** `@cloudflare/vitest-pool-workers`로 D1 연동 API 라우트 테스트까지 확대(별도 항목으로 분리 가능).

### T19 · GitHub Actions 액션 버전 업그레이드 — 🟢 S
배포 run에서 GitHub 경고: "Node.js 20 is deprecated — `actions/checkout@v4`, `actions/setup-node@v4`가 Node 24에서 강제 실행됨". 비차단(런은 성공)이지만 `actions/checkout@v5`·`actions/setup-node@v5`로 올려 정리. 참고로 이 경고는 앱이 쓰는 Node가 아니라 *액션 런타임*에 대한 것. (선택: job의 `node-version`도 로컬과 같은 22로 상향 고려.)
**관련 코드:** `.github/workflows/deploy.yml`.

---

## 추천 진행 순서 (Suggested Sequencing)

작은 묶음으로 나눠 점진적으로:

1. **빠른 수확 (Quick Wins):** B1·B2·W8·W9·Q2 — 반나절~하루, 즉시 체감.
2. **품질 묶음:** Q1(용어집) + P14(내 번역 재활용) — 교정 횟수를 근본적으로 감소.
3. **속도 묶음:** W6(논블로킹) + W7(스트리밍) — 10초 워크플로우 실현.
4. **커버리지 확장:** F11(영어→한국어) — 사용 빈도 2배.
5. **기반 정비:** T16(Vectorize) + T17(재시도) — 확장성/안정성.

---

## 완료 로그 (Done Log)

> 완료된 항목을 여기로 옮기고 완료일·커밋을 기록합니다.

| ID | 항목 | 완료일 | 커밋 |
|----|------|--------|------|
| B2 | DB에 잘못된 모델명 저장 → `resolvedModel`로 통일 | 2026-06-25 | `ab3a32f` |
| T18 | 테스트 기반 구축 (Vitest + 유닛 테스트 32개) | 2026-06-25 | `7de1f61` |
| B1+W8 | 자동 복사 작동 (`auto_copy` 연결 + 토스트, 컴포넌트 테스트 환경 구축) | 2026-06-25 | `2e42570` |
| W9 | 정확 일치 캐시 (키 = 텍스트+style+model, 가시화는 Q4) | 2026-06-25 | `6c82b66` |
| Q2 | 코드/영어 혼용 입력 보존 (프롬프트 공통 규칙) | 2026-06-25 | `2eb7166` |
| Q1 | 용어집 간단 버전 (설정 자유 텍스트 지침 → 프롬프트 주입) | 2026-06-25 | `3088168` |
| P14 | 내 즐겨찾기 번역을 few-shot 예시로 재활용 (PR1+PR2) | 2026-06-25 | `ed54b49`, `7e52f3e` |
| W6 | 유사 검색 논블로킹 (모달 → 결과 아래 제안 카드) | 2026-06-26 | `7a9114a` |
| Q6 | 출력 상한 8192 + 잘림 감지 경고 | 2026-06-26 | `2f51fd8` |
| W7 | 번역 결과 스트리밍 (NDJSON, 4단계) — 배포 후 E2E 수동 검증 권장 | 2026-06-26 | `25cf22c`·`732fabf`·`4508678` |
| P16 | As-you-type 번역 메모리 (bge-m3 핫패스 분리 + 옵트인 few-shot TM 패널; Phase 3 보류) — 배포·프로덕션 QA 통과 | 2026-06-30 | `200e837`·`a02ba5b`·`4e14613`·`9d138f1` |
