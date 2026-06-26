# Q1 설계안 — 용어집 (Glossary)

> 백로그 항목 **Q1** (`docs/IMPROVEMENTS.md`)의 상세 설계 문서.
> **상태:** 설계 검토 중 (구현 미착수)
> **작성:** 2026-06-25
> **목표:** 회사/도메인 고유 용어의 반복 교정 제거 → "수작업 교정 최소화"

이 설계는 유사 도구 리서치(DeepL·Google Cloud Translation·Lokalise·Phrase·Crowdin·Smartling·Trados MultiTerm·memoQ)와 한국어 형태론·LLM 프롬프트 주입 베스트프랙티스 조사를 반영했다. 출처는 각 절에 인라인.

---

## 0. 리서치 핵심 반영 (5가지)

1. **데이터 모델은 미니멀** — 거의 모든 도구의 공통 핵심은 `출발어 → 도착어` 쌍 + 번역금지(DNT) 플래그 + 메모뿐. 품사/성별/동의어/상태/언어쌍/양방향은 단일 사용자·단방향(KO→EN)에 불필요 → 제외.
2. **정확 매칭 금지** — 한국어는 교착어. 표제어 `결제`가 실제 텍스트에선 `결제를/결제가/결제는/결제에/결제로`처럼 조사가 같은 어절에 붙어 나옴. 정확/단어 단위 매칭은 이 변형을 모두 놓침. → **기본형만 저장**하고 정규화 후 **포함(containment) 매칭**.
3. **매칭된 용어만 주입** — 전체 용어집을 매 호출에 주입하면 정확도·비용 모두 악화(업계 합의 + 논문). 입력에 등장한 용어만 주입, 매칭 없으면 블록 자체 생략.
4. **캐시 상호작용 ⚠️** — 현재 W9 캐시 키는 `(korean_text, style, model)`뿐. 용어집을 수정해도 이미 번역된 입력에는 옛 결과가 캐시로 반환됨. → **용어집 시그니처(해시)를 캐시 키에 포함**해야 정합성 유지.
5. **LLM은 확률적 준수** — 프롬프트 용어집은 비결정적. 지시문을 "반드시 사용" 같은 하드 제약으로 작성하고, 완고한 용어는 few-shot 예시로 보강(→ P14와 시너지).

**출처:** [DeepL multilingual glossaries](https://developers.deepl.com/api-reference/multilingual-glossaries) · [DeepL "About the glossary"](https://support.deepl.com/hc/en-us/articles/360021634540-About-the-glossary) · [Google Cloud Translation glossary](https://docs.cloud.google.com/translate/docs/advanced/glossary) · [Lokalise glossary](https://docs.lokalise.com/en/articles/1400629-glossary) · [Lokalise AI translation + glossary](https://lokalise.com/blog/ai-translation-glossary/) · [Phrase Term Bases](https://support.phrase.com/hc/en-us/articles/5709733372188-Term-Bases-TMS-) · [Smartling glossary entry](https://help.smartling.com/hc/en-us/articles/12026027210139-Elements-of-a-Glossary-Entry) · [memoQ non-translatable lists](https://docs.memoq.com/current/en/Concepts/concepts-non-translatable-lists.html) · [memoQ term base entry](https://docs.memoq.com/current/en/Workspace/edit-term-base-entry.html) · [KoNLPy morphology](https://konlpy.org/en/latest/morph/) · [SwissGlobal prompting strategies](https://swissglobal.ch/en/blog/prompting-strategies-for-ai-translation-what-works-across-llms/) · [Translated.com prompt engineering](https://translated.com/resources/prompt-engineering-for-translation-guiding-ai-domain-accuracy)

---

## 1. 데이터 모델 — 새 마이그레이션 `0004_create_glossary.sql`

```sql
CREATE TABLE IF NOT EXISTS glossary (
  id               TEXT PRIMARY KEY,
  source_term      TEXT NOT NULL,                 -- 한국어 기본형 (결제)
  target_term      TEXT,                          -- 영어 (payment); DNT면 무시/NULL
  do_not_translate INTEGER NOT NULL DEFAULT 0,    -- 1 = 원문 그대로 유지 (브랜드/제품/코드)
  case_sensitive   INTEGER NOT NULL DEFAULT 0,    -- 기본 OFF; 한국어엔 대소문자 없음, 임베드된 ASCII에만 의미
  note             TEXT,                           -- 선택: 용법/구분 메모
  enabled          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_glossary_enabled ON glossary(enabled);
```

- 기존 컨벤션 준수: TEXT id, ISO 타임스탬프, INTEGER 불리언.
- **제외**: 품사·성별·동의어·상태·언어쌍·양방향 컬럼 (단일 사용자·단방향이라 사장됨).
- `match_norm` 같은 사전계산 컬럼 **안 둠** — 단일 사용자(수십~수백 용어)라 매 요청 메모리 정규화로 충분.
- `forbidden_term`(쓰지 말 영어 표현)은 리서치가 "유일하게 챙길 만한 nice-to-have"라 했으나 **Q1 범위 집중을 위해 보류**(나중에 컬럼 추가 용이) — *결정 ① 참조*.

---

## 2. 매칭 로직 — `lib/glossary.ts` (순수 함수)

- `normalizeTerm(text, caseSensitive)` — NFC 정규화 + (ASCII 포함·비대소문자면) ASCII 소문자화.
- `matchGlossary(input, entries)` — 입력 정규화 후 각 enabled 엔트리의 기본형이 **포함**되는지 검사 → 매칭 목록. 겹치면 **longest-match-wins**.
- **recall 우선**: false negative(용어가 프롬프트에 미반영)는 비싼 오류, false positive(LLM이 무시할 힌트 1개)는 싼 오류. 한국어 조사 변형은 포함 매칭이 자연히 흡수(`결제` ⊂ `결제를`).
- **v1 = 정규화 포함 매칭**(단순). 어절(eojeol) 접두 매칭으로 `미결제`의 `결제` 오탐을 줄이는 정밀화는 순수 함수라 후속으로 쉽게 추가 — *결정 ③ 참조*.
- 조사 스트리핑은 선택(포함 매칭이 이미 흡수하므로 v1 생략).

**근거:** 우리 설계는 검색-치환이 아니라 **프롬프트 주입**이라 매처의 역할은 "탐지"뿐 — 영어 굴절은 LLM이 처리(DeepL이 의존하는 target-side 적응과 동일). 따라서 느슨한 recall 우선 매칭이 안전. ([DeepL](https://support.deepl.com/hc/en-us/articles/360021634540-About-the-glossary), [KoNLPy](https://konlpy.org/en/latest/morph/))

---

## 3. 프롬프트 주입 — `buildTranslationPrompt` 확장 (`lib/prompts.ts`)

매칭된 용어만으로 블록 구성, 기존 `ruleLine`/`contextLine` 자리(입력 바로 앞)에 삽입. 매칭 없으면 블록 생략:

```
Glossary (use these renderings when the Korean appears; the English may be
inflected/pluralized to read naturally):
- 결제 → payment
- 정산 → settlement
Do not translate — keep exactly as written: Acme, 어드민 (Admin)
```

- 하드 제약 문구로 표현, **DNT는 별도 줄**(기존 `CODE_PRESERVATION_RULE`을 한국어 표기 브랜드/제품까지 확장하는 셈).
- `buildGlossaryBlock(matched)` 순수 함수로 분리 → 빈 입력 시 `""`, DNT/매핑 줄 분리, longest-match-wins.

**출처:** 매칭된 용어만 주입이 업계 합의 ([Lokalise](https://lokalise.com/blog/ai-translation-glossary/), [Phrase](https://support.phrase.com/hc/en-us/articles/5709733372188-Term-Bases-TMS-)). 하드 제약 문구 ([SwissGlobal](https://swissglobal.ch/en/blog/prompting-strategies-for-ai-translation-what-works-across-llms/), [Translated.com](https://translated.com/resources/prompt-engineering-for-translation-guiding-ai-domain-accuracy)).

---

## 4. 캐시 정합성 — W9 연계 (필수)

리서치가 명시적으로 경고한 우리 코드 특유의 함정.

- `lib/glossary.ts`에 `glossarySignature(entries)` — enabled 엔트리를 정렬·직렬화한 결정적 해시(순서 무관, 내용 변경 시 달라짐).
- `translations` 테이블에 `glossary_signature TEXT` 컬럼 추가(마이그레이션), 번역 저장 시 당시 시그니처 기록.
- `findCachedTranslation`(`lib/cache.ts`) 조회 키에 시그니처 추가 → **용어집 수정 시 시그니처 변경 → 옛 캐시 미스 → 현재 용어집으로 재번역**.
- 해시·시그니처 모두 순수 함수 → 유닛 테스트.

---

## 5. API + UI

- **`app/api/glossary/route.ts`** — GET(목록)/POST(추가)/PATCH(수정)/DELETE. 기존 `app/api/history/route.ts` 패턴 재사용.
- **설정 페이지**(`app/settings/page.tsx`)에 용어집 섹션 — 목록 + 추가/수정/삭제 폼, DNT 토글, enabled 토글.

---

## 6. 테스트 계획 (작업 규칙: 모든 개선은 테스트와 함께)

- **순수 함수 유닛**: `normalizeTerm`, `matchGlossary`(조사형 `결제를` 매칭·longest-match·DNT 포함), `buildGlossaryBlock`(빈→`""`·DNT 줄 분리), `glossarySignature`(내용 변경 시 달라짐·순서 무관), `buildTranslationPrompt` 주입 검증.
- **캐시**: `findCachedTranslation`에 시그니처 인자 추가 → 바인딩 유닛.
- **UI**: 설정 용어집 섹션 컴포넌트 테스트(jsdom + RTL, fetch 모킹).

---

## 7. 구현 순서 (PR 분할)

1. 마이그레이션(`glossary` + `translations.glossary_signature`) + `lib/glossary.ts`(매칭/주입/시그니처) + `buildTranslationPrompt` 주입 + 유닛 테스트
2. 라우트 연결(`app/api/translate`: 로드 → 매칭 → 주입) + 캐시 시그니처 통합(W9 정합성)
3. CRUD API (`app/api/glossary`)
4. 설정 UI (+ 컴포넌트 테스트)

---

## 8. 미결정 사항 (제 추천 포함)

| # | 결정 | 추천 |
|---|------|------|
| ① | `forbidden_term`(쓰지 말 표현) 컬럼/기능 | **Q1 제외, 후속 추가** |
| ② | 캐시 정합성 처리 | **용어집 시그니처를 캐시 키에 포함** (정확함) |
| ③ | 매칭 정밀도 v1 | **정규화 포함 매칭** (단순; 어절 접두는 후속) |

확정 시 **1번 PR**부터 착수.

---

## 함정 체크리스트 (구현 시 재확인)
- ❌ 정확/단어 매칭 — 한국어 조사형 전부 놓침.
- ❌ 전체 용어집 매 호출 주입 — 정확도·비용 악화.
- ❌ 굴절형(`결제를`)을 별도 행으로 저장 — 기본형만 저장하고 매칭+LLM에 맡김.
- ⚠️ 캐시 키에 용어집 시그니처 없으면 편집이 캐시된 입력에 반영 안 됨.
- ⚠️ LLM 준수는 확률적 — 문구 강하게, 완고한 용어는 few-shot.
- ℹ️ case-sensitivity 기본 OFF(한국어 무관, 임베드 ASCII에만).
