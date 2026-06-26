# P14 설계안 — 내 과거 번역을 few-shot으로 재활용

> 백로그 항목 **P14** (`docs/IMPROVEMENTS.md`)의 상세 설계 문서.
> **상태:** 설계 검토 중 (구현 미착수)
> **작성:** 2026-06-25
> **목표:** 번역이 *내가 이미 승인한 표현*에 수렴 → 쓸수록 교정 감소(자기 개선)

핵심 관점: **이 기능은 새 서브시스템이 아니라, 이미 있는 부품의 배선이다.** 그래서 "단순 버전으로 깎는다"가 아니라 *자연스러운 형태가 이미 작다*. Q1처럼 새 테이블/마이그레이션/한국어 형태소 매칭 같은 신규 표면이 없다.

---

## 1. 무엇을 하는가 (구체 예시)

현재 프롬프트의 few-shot 예시는 `lib/prompts.ts`의 `STYLE_PROMPTS`에 **하드코딩된 일반 문장**이다:
> "이 부분 확인해줄 수 있어? → Could you take a look at this?"

P14는 여기에, **내 과거 즐겨찾기 번역 중 지금 입력과 비슷한 것**을 동적으로 골라 예시로 추가한다.
- 입력: `이 PR 리뷰 좀 부탁해`
- 과거 즐겨찾기에서 유사 항목 발견: `이 코드 리뷰해줄 수 있어? → Mind giving this a review?`
- 그 쌍을 프롬프트에 예시로 주입 → 모델이 **내 말투를 따라함**

---

## 2. 재사용하는 기존 인프라 (이미 있음, 일부는 테스트됨)

| 부품 | 위치 | 상태 |
|------|------|------|
| 번역별 임베딩 저장 | `translations.embedding` 컬럼 | 있음 |
| 코사인 유사도 / 유사 검색 | `lib/similarity.ts` (`findSimilarTranslations`) | **유닛 테스트 8개 있음** |
| 임베딩 생성 | `lib/ai/embedding.ts` (`getEmbedding`) | 있음 |
| 유사 검색 라우트 | `app/api/similar/route.ts` | 동작 중 |
| 프롬프트 주입 자리 | `buildTranslationPrompt` (Q1 글로서리 넣은 곳) | 있음 |
| 즐겨찾기 플래그 | `translations.is_favorite` | 있음 |

## 3. 새로 추가하는 것 (최소)

1. **순수 함수** (`lib/examples.ts` 신규):
   - `selectFewShotExamples(queryEmbedding, candidates, opts)` — `findSimilarTranslations` 재사용해 즐겨찾기 후보 중 상위 K개 선택 → `{ korean, english }[]` 반환
   - `buildExamplesLine(examples)` — 선택된 쌍을 프롬프트 블록 문자열로 포맷(빈 배열 → `""`)
2. **`buildTranslationPrompt`** — 5번째 옵셔널 인자 `examples?`로 개인화 예시 블록 주입.
3. **`app/api/translate/route.ts`** — 입력 임베딩을 *번역 전*에 1회 계산(검색용) → 즐겨찾기 후보 조회 → 예시 선택 → 주입. 같은 임베딩을 저장에도 재사용(현재는 번역 후 별도 계산 → 1회로 통합).

---

## 4. 회귀 위험은 낮다 (Q1-simple과 같은 안전판)

- **콜드 스타트 / 유사 항목 없음 / OpenAI 키 없음 → 개인화 블록 생략 = 지금과 동일한 프롬프트(정적 예시).** "안 쓰면 no-op"이 성립.
- 새 표면은 *번역 전 임베딩 1회 + 예시 주입*뿐. similarity 코드는 이미 테스트됨.
- `STYLE_PROMPTS` 템플릿(정적 예시)은 **건드리지 않음** — 개인화 블록은 *추가*만.

---

## 5. 프롬프트 주입 형식 (`buildTranslationPrompt`)

정적 예시는 유지(스타일 베이스라인), 개인화 블록을 입력 근처에 *추가*. 매칭 없으면 블록 생략:

```
Here is how you've translated similar messages before — match this voice:
- 이 코드 리뷰해줄 수 있어? → Mind giving this a review?
- 배포 다시 돌릴게 → I'll re-run the deploy
```

`buildExamplesLine(examples)` 순수 함수로 분리 → 빈 입력 시 `""`.

---

## 6. 캐시 상호작용 (W9)

- P14는 **캐시 미스일 때만** 작동(히트는 저장된 번역을 그대로 반환).
- 동일 입력을 재번역하면 캐시가 옛 결과를 반환 → 그 사이 늘어난 즐겨찾기 예시가 반영 안 됨. Q1과 같은 가벼운 staleness → **Q4 "새로 번역"으로 우회**. 캐시 키 변경은 하지 않음.

---

## 7. 영향 파일

- `lib/examples.ts` (신규: 선택/포맷 순수 함수)
- `lib/prompts.ts` (`buildTranslationPrompt` 5번째 인자)
- `app/api/translate/route.ts` (임베딩 선계산 + 후보 조회 + 주입)
- (`lib/similarity.ts` 재사용, 변경 없음)

---

## 8. 테스트 계획 (작업 규칙: 모든 개선은 테스트와 함께)

- **순수 함수 유닛**:
  - `buildExamplesLine`: 빈 배열 → `""`, 포맷, 입력 자신 제외 처리.
  - `selectFewShotExamples`: 임계값 필터·정렬·limit·즐겨찾기 후보만·잘못된 임베딩 스킵(= `findSimilarTranslations` 동작 위임 확인).
  - `buildTranslationPrompt`: examples 주입/생략.
- **라우트 통합**(임베딩 선계산·후보 조회): Workers 풀(T16/후속)로 확대 — 지금은 로직 단위로 커버.

---

## 9. 구현 순서 (PR 분할)

1. `lib/examples.ts`(선택/포맷) + `buildTranslationPrompt` 주입 + 유닛 테스트
2. 라우트 연결: 입력 임베딩 *번역 전* 1회 계산(검색+저장 공유) + 즐겨찾기 후보 조회 + 예시 선택·주입
3. 폴백 점검(콜드스타트/노키/유사 없음 → 정적 예시)

---

## 10. 미결정 사항 (제 추천 포함)

| # | 결정 | 추천 |
|---|------|------|
| ① | 예시 출처 | **즐겨찾기 우선(미검증 제외)** — 품질 우선, 나중에 확장 가능 |
| ② | 예시 개수 K | **3개** (과적합·프롬프트 비대 방지) |
| ③ | 유사도 임계값 | **~0.75** (재사용 모달의 0.85와 *별개* — 더 낮춰 "관련 예시"를 더 자주 활성) |
| ④ | 주입 방식 | **정적 예시 유지 + 개인화 블록 추가** (템플릿 미변경, 저위험) |
| ⑤ | `buildTranslationPrompt` 시그니처 | **5번째 옵셔널 인자** (최소 변경) — 대안: 옵션 객체 리팩터 |

---

## 11. 함정 체크리스트
- ⚠️ 미검증(즐겨찾기 아님) 예시를 넣으면 나쁜 스타일 전파 → **즐겨찾기 우선**.
- ⚠️ 예시 과다 → 프롬프트 비대·과적합 → **K 제한**.
- ⚠️ OpenAI 키/유사 항목 없을 때 폴백 누락 → 반드시 정적 예시로 degrade.
- ℹ️ 입력 자신을 예시로 넣지 않기(아직 저장 전이라 자연 회피되지만 방어적으로 확인).
- ℹ️ 임베딩 중복 호출 피하기 — 번역 전 1회 계산해 검색·저장 공유.
- ℹ️ 캐시 staleness는 Q4로 우회(키 변경 안 함).
