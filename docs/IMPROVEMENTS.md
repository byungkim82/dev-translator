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
| Q1 | 용어집(Glossary) / 고정 번역 사전 | 품질 | 🔴 | M | 🔲 |
| Q2 | 코드/영어 혼용 입력 보존 | 품질 | 🔴 | S | 🔲 |
| Q3 | 답장 맥락(원문 메시지) 입력 | 품질 | 🟡 | M | 🔲 |
| Q4 | 번역 후 미세 조정(refine/regenerate) | 품질 | 🟡 | M | 🔲 |
| Q5 | 대안 2~3개 동시 제시 | 품질 | 🟢 | M | 🔲 |
| W6 | 유사 검색 논블로킹/병렬화 | 워크플로우 | 🔴 | M | 🔲 |
| W7 | 스트리밍 출력 | 워크플로우 | 🔴 | M | 🔲 |
| W8 | 자동 복사 + 토스트 (B1 연계) | 워크플로우 | 🔴 | S | ✅ |
| W9 | 정확 일치 캐시 | 워크플로우 | 🟡 | S | 🔲 |
| W10 | 브라우저 확장 / 전역 단축키 | 워크플로우 | 🟢 | L | 🔲 |
| F11 | 영어 → 한국어 (읽기 모드) | 기능 | 🔴 | M | 🔲 |
| F12 | "내 영어 다듬기" 모드 | 기능 | 🟢 | M | 🔲 |
| F13 | 자주 쓰는 템플릿/스니펫 | 기능 | 🟢 | M | 🔲 |
| P14 | 내 과거 번역을 few-shot으로 재활용 | 개인화 | 🔴 | L | 🔲 |
| P15 | 인라인 편집 + 교정 학습 | 개인화 | 🟡 | M | 🔲 |
| T16 | 유사 검색을 Cloudflare Vectorize로 이전 | 기술 | 🟡 | L | 🔲 |
| T17 | Gemini 호출 타임아웃/재시도 | 기술 | 🟡 | S | 🔲 |
| T18 | 테스트 기반 구축 (Vitest + 순수 함수 유닛 테스트) | 기술 | 🟡 | M | ✅ |

---

## 🐞 버그 (Bugs)

### B1 · `auto_copy` 설정이 동작하지 않음 — 🔴 S — ✅
`settings`에 `auto_copy`가 로드되지만(`app/page.tsx:41-45`) 번역 완료 흐름 `executeTranslation`에서 전혀 사용되지 않아 자동 복사 설정이 죽어 있던 문제. **W8과 함께 수정 완료** — 상세는 W8 참고.

### B2 · DB에 잘못된 모델명 저장 — 🟡 S
`app/api/translate/route.ts:63`에서 `model || "gemini-flash"`로 저장하지만 실제 기본 키는 `"gemini-flash-lite"`. 기본 모델로 번역 시 DB에 존재하지 않는 `gemini-flash`가 기록됨(통계/필터 왜곡 가능).
**고치기:** fallback을 `"gemini-flash-lite"`로 통일.

---

## 🎯 번역 품질 (Quality) — 수작업 교정 최소화 직결

### Q1 · 용어집(Glossary) / 고정 번역 사전 — 🔴 M
회사 제품명·내부 약어·팀 이름·고유명사를 "이건 이렇게 번역 / 절대 번역 안 함"으로 등록해 프롬프트에 주입. 매번 같은 단어를 손으로 고치는 일을 제거.
**관련 코드:** `lib/prompts.ts`(주입), `migrations/`(glossary 테이블), settings UI.

### Q2 · 코드/영어 혼용 입력 보존 — 🔴 S
"이 PR을 merge 했고 staging에 deploy 했어" 같은 입력에서 `merge`/`deploy`/함수명/변수명을 그대로 유지하도록 프롬프트에 명시.
**관련 코드:** `lib/prompts.ts`의 `STYLE_PROMPTS` 공통 지시문.

### Q3 · 답장 맥락(원문 메시지) 입력 — 🟡 M
"내가 답하는 원문 메시지" 입력란 추가 → 대명사·시제·톤 정확도 향상.
**관련 코드:** `components/TranslateForm.tsx`(입력란), `lib/prompts.ts`(맥락 주입), `app/api/translate/route.ts`(파라미터).

### Q4 · 번역 후 미세 조정(refine / regenerate) — 🟡 M
결과 영역에 "더 짧게 / 더 정중하게 / 덜 격식있게 / 다시 생성" 버튼. 재입력 없이 한 번 더 돌려 완성도 향상.
**관련 코드:** `components/TranslationResult.tsx`, 새 refine 엔드포인트 또는 `translate` 확장.

### Q5 · 대안 2~3개 동시 제시 — 🟢 M
한 번 호출로 변형 여러 개를 받아 골라 쓰기. 애매한 뉘앙스를 교정 대신 선택으로 해결.
**관련 코드:** `lib/ai/gemini.ts`(다중 후보), `components/TranslationResult.tsx`(선택 UI).

---

## ⚡ 속도 & 워크플로우 (Workflow) — 핵심 가치 = 10초

### W6 · 유사 검색 논블로킹/병렬화 — 🔴 M
현재 `handleTranslate`(`app/page.tsx:68-103`)는 **모든 번역마다** `/api/similar`를 먼저 호출하고 0.85 초과가 있으면 모달로 흐름을 끊음 → 매번 지연 + 방해. 번역을 즉시 시작하고 유사 결과는 비차단 "참고"로 표시하거나 둘을 병렬 실행.
**관련 코드:** `app/page.tsx`, `app/api/similar/route.ts`.

### W7 · 스트리밍 출력 — 🔴 M
Gemini를 `streamGenerateContent`로 바꿔 토큰 단위 출력 → 체감 속도 대폭 향상. 현재는 완료까지 빈 화면 대기(`lib/ai/gemini.ts`는 `generateContent` 사용).
**관련 코드:** `lib/ai/gemini.ts`, `app/api/translate/route.ts`(스트림 응답), 결과 컴포넌트.

### W8 · 자동 복사 + 토스트 — 🔴 S — ✅
B1 수정 포함. 번역이 끝나면 바로 클립보드에 들어가 붙여넣기만 하면 되게.
**완료 범위:** `app/page.tsx`에 `autoCopy()` 헬퍼 추가 → `executeTranslation` 성공 시와 `handleUseSimilar`(기존 번역 재사용) 시 `settings.auto_copy`가 켜져 있으면 결과를 클립보드에 자동 복사 + "자동 복사됨" 토스트, 실패 시 안내 토스트로 폴백.
**테스트:** `app/page.test.tsx` 컴포넌트 테스트(jsdom + React Testing Library, `fetch`/clipboard 모킹) — auto_copy ON이면 클립보드 호출·OFF면 미호출 검증. 이 작업으로 **컴포넌트 테스트 환경도 함께 구축**됨(`@vitejs/plugin-react`, jsdom, RTL).
**알려진 제약:** `navigator.clipboard.writeText`는 비동기 fetch 이후 호출돼 일부 브라우저(특히 Safari)에서 사용자 제스처 밖이라 차단될 수 있음 → 그 경우 폴백 토스트가 뜨고 수동 복사 버튼으로 처리.

### W9 · 정확 일치 캐시 — 🟡 S
동일 한국어 + 스타일 입력은 DB에서 즉시 반환(API 호출·임베딩 비용 0). 번역 전에 정확 일치 조회.
**관련 코드:** `app/api/translate/route.ts`.

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
**관련 코드:** `lib/prompts.ts`, `lib/similarity.ts`, `app/api/translate/route.ts`.

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
