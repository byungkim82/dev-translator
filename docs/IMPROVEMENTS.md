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
| W7 | 스트리밍 출력 | 워크플로우 | 🔴 | M | 🔲 |
| W8 | 자동 복사 + 토스트 (B1 연계) | 워크플로우 | 🔴 | S | ✅ |
| W9 | 정확 일치 캐시 | 워크플로우 | 🟡 | S | ✅ |
| W10 | 브라우저 확장 / 전역 단축키 | 워크플로우 | 🟢 | L | 🔲 |
| F11 | 영어 → 한국어 (읽기 모드) | 기능 | 🔴 | M | 🔲 |
| F12 | "내 영어 다듬기" 모드 | 기능 | 🟢 | M | 🔲 |
| F13 | 자주 쓰는 템플릿/스니펫 | 기능 | 🟢 | M | 🔲 |
| P14 | 내 과거 번역을 few-shot으로 재활용 | 개인화 | 🔴 | L | ✅ |
| P15 | 인라인 편집 + 교정 학습 | 개인화 | 🟡 | M | 🔲 |
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
**관련 코드:** `lib/ai/gemini.ts`, `app/api/translate/route.ts`(스트림 응답), 결과 컴포넌트.

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
