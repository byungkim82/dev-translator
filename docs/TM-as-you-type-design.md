# 설계안 — As-you-type 번역 메모리 (Translation Memory)

> **상태:** Phase 1 완료 · Phase 2 구현 완료 (§11: PR-a 백엔드 + PR-b 프론트 as-you-type TM 패널) · 배포·실측 남음 · Phase 3 보류
> **작성:** 2026-06-26
> **관련:** P14(개인화 few-shot)·W6(유사 제안)·T16(Vectorize) 를 통합/대체. 임베딩 지연(1.3s) 문제 해결.

사용자가 한국어를 **입력하는 동안**(전송 전, 디바운스) 과거 즐겨찾기 번역에서 비슷한 걸 찾아 보여주고, 강한 매치가 있으면 **옵트인으로 few-shot 예시에 주입**. 번역 호출은 임베딩에 막히지 않음. 임베딩은 백그라운드 "기록"으로만. → 전문 번역 도구의 **Translation Memory(TM) + 퍼지 매칭** 패턴을, LLM few-shot + 엣지 임베딩으로 현대화.

---

## 0. 리서치 핵심 판정

| 질문 | 판정 |
|------|------|
| 타이핑-중 조회 방식 | **키 입력마다 X.** 멈춤 후 디바운스(로컬/캐시 ~300ms, 네트워크/모델 호출 ~400–600ms), 최소 3자, 쿼리 문자열로 캐시. TM 관례: 85%+ = "확신 매치". |
| 프라이버시 | **단일 사용자+Access면 사실상 무이슈** — 내 키 입력을 내 Worker로 보내는 것. 디바운스는 *비용* 절감용. 진짜 외부 경계는 모델 벤더 → **OpenAI 제거가 프라이버시 이득**. |
| 엣지 임베딩(Workers AI) 한국어 품질 | **`@cf/baai/bge-m3`(1024차원, 다국어, $0.012)로 OpenAI 대체 = 업그레이드.** MIRACL-Korean nDCG@10: bge-m3 **69.9** > OpenAI 3-small **63.9** (~+9pt). 더 싸고 D1과 같은 엣지. |
| 로컬/브라우저 임베딩 | **가능**(`multilingual-e5-small` q8, 118MB, 384차원, WASM). 단 한국어 품질 낮음(61.2)+최초 118MB 로드 → *2단계 옵션*(완전 로컬·무round-trip). |
| 혼용/마이그레이션 | **모델 다르면 벡터 비교 불가.** 전체 재임베딩 + 버전 태그 + 별도 컬럼. 정당한 하이브리드 = recall→rerank(원문 재読). |
| 검색 효율 | 소규모(수백~수천)는 **현재 JS 스캔 유지**가 정답. Vectorize는 1만+ 또는 멀티유저에서. 단일 사용자면 **클라이언트 사이드 검색**도 우아. |

**핵심 단서**: 우리 코퍼스는 (개인 도구라) **아직 작음** → 재임베딩 마이그레이션 비용이 미미. 위험 낮음.

출처: [bge-m3 MIRACL-Korean (arXiv 2402.03216)](https://arxiv.org/html/2402.03216v3) · [Korean RAG embedding guide](https://www.data-dynamics.io/en/blog/embedding-model-guide) · [Workers AI models](https://developers.cloudflare.com/workers-ai/models/)·[pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)·[bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/) · [Transformers.js v3](https://huggingface.co/blog/transformersjs-v3) · [memoQ match rates](https://docs.memoq.com/current/en/Concepts/concepts-match-rates-from-translation-m.html) · [임베딩 버전관리](https://milvus.io/ai-quick-reference/what-are-best-practices-for-updating-embeddings-in-production) · [Vectorize 한계](https://developers.cloudflare.com/vectorize/platform/limits/) · [리랭커](https://www.pinecone.io/learn/series/rag/rerankers/)

---

## 1. 목표 아키텍처

- **임베딩 생성**: `@cf/baai/bge-m3` (Workers AI `AI` 바인딩, 엣지). OpenAI 제거.
- **저장/검색**: D1에 벡터 저장 + 기존 JS 코사인 스캔 유지. Vectorize 미도입.
- **타이핑-중 TM**:
  1. 클라가 입력 멈춤 후 ~500ms 디바운스(최소 3자, 쿼리 캐시) → `POST /api/tm`
  2. `/api/tm`: 쿼리를 bge-m3로 임베딩 → 즐겨찾기 행 스캔 → 재보정된 임계값 이상 매치 반환
  3. UI에 강한 매치를 TM 패널로 표시(일치율%) → 사용자가 **체크(옵트인)** → 그 `exampleIds`를 번역 요청에 실음
  4. **번역은 임베딩 안 함** — `exampleIds`를 id로 조회해 프롬프트에 주입(핫패스에 임베딩 0). P14의 1.3s 블록 제거
  5. 임베딩은 **스트림 종료 후 백그라운드**로 생성·저장(`finalizeTranslation` 근처). 번역 응답을 막지 않음
- **W6 + P14 통합**: 한 번의 TM 조회가 ① 참고/재사용 표시(W6) ② 예시 주입 옵트인(P14) 둘 다 담당.

---

## 2. 단계별 계획 (각 단계 독립 배포 가능)

### Phase 1 — bge-m3로 전환 + 임베딩을 핫패스에서 분리 (지연 해결 + OpenAI 제거)
- `wrangler.toml`에 `[ai]` 바인딩, `lib/ai/embedding-edge.ts`(`env.AI.run("@cf/baai/bge-m3",{text})`).
- 마이그레이션 `0005`: `embedding_version TEXT` + `embedding_v2 TEXT`(1024차원). 기존 `embedding`(1536) 보존.
- `/api/translate`: **인라인 임베딩 제거** → 스트림 종료 후 백그라운드로 bge-m3 임베딩 저장(`embedding_v2`+버전). **→ 1.3s 블록 즉시 제거.**
- 기존 코퍼스 백필(작아서 빠름). W6/`/api/similar`도 bge-m3·버전 게이팅으로.
- **임계값 재보정**(0.85는 OpenAI 기준 → bge-m3 분포로 실측 재설정).
- *이 단계에선 P14 인라인 주입은 잠시 빠짐*(다음 단계의 옵트인으로 부활) — 또는 원하면 bge-m3 인라인 유지(엣지라 빠름, 단 측정 필요).

### Phase 2 — As-you-type TM 패널 (핵심 기능)
- `app/api/tm/route.ts`(신규): 디바운스된 조회(임베딩+즐겨찾기 스캔→매치).
- 클라(`TranslateForm`): 입력 디바운스(~500ms·최소3자·쿼리캐시·AbortController) → 매치 패널 → 옵트인 체크 → `exampleIds`.
- `/api/translate`: `exampleIds` 받아 id로 예시 조회·주입(임베딩 없이). W9 캐시 키에 "예시 적용 여부" 반영.
- W6 제안 카드를 이 패널로 통합.

### Phase 3 — (선택) 완전 로컬 인-브라우저 티어
- `multilingual-e5-small`(q8, WASM)로 타이핑-중 조회를 브라우저에서 → 서버 round-trip 0, 완전 프라이빗.
- 단 2-모델 하이브리드(양쪽 벡터 저장) + 한국어 품질 낮음 + 118MB 로드 → **나중에**.

---

## 3. 마이그레이션 (저위험·가역)
- `0005_add_embedding_version.sql`: `embedding_version`, `embedding_v2` 추가(기존 컬럼 무수정).
- 백필: 50~100행씩 페이지로 bge-m3 재임베딩 → `embedding_v2`+`bgem3-1024` 태그. (코퍼스 작아 일회성으로 충분.)
- 유사도는 `embedding_version='bgem3-1024'`로 게이팅 → 마이그레이션 중 공간 혼합 방지.
- 검증 후 W6/P14를 `embedding_v2`로 전환 → 나중 정리에서 `embedding`/OpenAI 코드 제거.

## 4. 테스트 계획 (작업 규칙)
- **순수 유닛**: `cosineSimilarity`/`selectFewShotExamples`는 이미 차원-무관·순수 → 유지. 버전 게이팅·`/api/tm` 선택 로직 유닛(가짜 DB·`env.AI.run` 모킹).
- **클라 컴포넌트**(jsdom): 디바운스(가짜 타이머)·쿼리 캐시·옵트인 체크 → `exampleIds` 전달·취소(AbortController).
- **수동/실측**(아래 §6): bge-m3 한국어 품질·엣지 지연·임계값.

## 5. 정해주실 결정
| # | 결정 | 추천 |
|---|------|------|
| ① | OpenAI → **bge-m3** 전환(재임베딩 마이그레이션) | **예** (한국어 ↑, 비용 ↓, 엣지, 프라이버시 ↑) |
| ② | 시작점 | **Phase 1**(지연 해결+전환) → Phase 2(as-you-type) |
| ③ | Phase 1에서 P14 인라인 | **잠시 내려놓고** Phase 2 옵트인으로 부활 (vs bge-m3 인라인 유지) |
| ④ | Phase 3(인-브라우저) | **보류**(선택) |
| ⑤ | 검색 | **JS 스캔 유지**, Vectorize 미도입 |

## 6. 실측으로만 검증되는 것 (플래그)
1. **bge-m3의 *우리 짧은-문장 패러프레이즈* 한국어 품질** — 벤치마크는 IR이지 STS 아님. 전환 전 스팟체크.
2. **bge-m3용 유사도 임계값** — 분포가 OpenAI와 달라 재보정 필수.
3. **Workers AI 엣지 임베딩 지연** — Cloudflare 미문서화 → 측정.
4. (Phase 3) **인-브라우저 임베딩 지연**(WASM/WebGPU) — 기기/브라우저 의존.
5. **Qwen3-Embedding-0.6B vs bge-m3**(둘 다 $0.012, Qwen3가 MMTEB 더 높음) — 우리 데이터로 A/B 가치.

## 7. 영향 파일
`wrangler.toml`(`[ai]` ✅ 추가됨), `lib/ai/embedding-edge.ts`(✅ 추가됨, `getEdgeEmbedding`), `migrations/0005_add_embedding_version.sql`(신규), `app/api/translate/route.ts`(인라인 임베딩 제거·`exampleIds` 수용·백그라운드 기록), `app/api/similar/route.ts`(bge-m3·버전게이팅), `app/api/tm/route.ts`(신규), `components/TranslateForm.tsx`(디바운스 조회·TM 패널), `lib/translate-core.ts`(백그라운드 임베딩).

## 8. 스팟체크 결과 & 확정 (2026-06-26, Phase 1 착수 전 검증 완료)
임시 `/api/embedtest`(삭제됨)로 dev 문장 6개(리뷰 3 + 배포 2 + 무관 1)를 세 모델로 임베딩, 쌍별 코사인·지연 비교:

| 모델 | 강한 패러프레이즈 | 내부 최저 | 외부 최고 | 분리 | 지연(6문장) |
|---|---|---|---|---|---|
| **bge-m3** | 0.71·0.74·0.74 | 0.543 | 0.543 | 겹침 | **~254ms** |
| qwen3-0.6b | 0.57·0.64·0.74 | 0.533 | 0.508 | +0.025 | ~2382ms |
| OpenAI 3-small | 0.53·0.55·0.65 | 0.463 | 0.299 | +0.164 | ~1337ms |

**확정 결정:**
- **모델 = `@cf/baai/bge-m3` (1024차원).** 약한 매치는 노이즈와 겹치나 **강한 패러프레이즈가 0.7+로 또렷**, OpenAI 대비 **~5배 빠름**(254 vs 1337ms) — as-you-type 필수.
- **임계값 = ~0.68.** "특별한·강한 매치만" 발동(=사용자 의도). 이 테스트에서 0.68은 강한 패러프레이즈만 통과(오탐 0), 약한·무관 전부 차단. → 실데이터로 미세조정.
- **qwen3 드롭**(분리 미미 + 가장 느림), **OpenAI 드롭**(느림 + 제거 대상). 단일 모델.
- 발견: 현재 코드 임계값(W6 0.85/P14 0.75)은 너무 높아 *실제 패러프레이즈도 거의 안 잡힘* → 0.68로 내려야 작동.

## 9. Phase 1 체크리스트 — ✅ 완료 (2026-06-26)
기반(커밋됨): `[ai]` 바인딩, `env.AI` 타입, `lib/ai/embedding-edge.ts`. 모델·임계값 확정(§8).
**Phase 1 작업** (확정 파라미터: 모델 `@cf/baai/bge-m3`, 차원 1024, 버전태그 `bgem3-1024`, 임계값 0.68):
1. ✅ `migrations/0005_add_embedding_version.sql` — `embedding_version TEXT`, `embedding_v2 TEXT` 추가(기존 `embedding` 보존).
2. ✅ `app/api/translate/route.ts` — 인라인 임베딩·P14 조회 제거 → `controller.close()` 후 `ctx.waitUntil(recordEdgeEmbedding(db, ai, …))`로 bge-m3 임베딩을 `embedding_v2`+버전 저장(번역 비차단, best-effort). **→ ~1.3s 블록 제거.** 핵심 로직은 `lib/translate-core.ts`의 `recordEdgeEmbedding`(주입 DB·AI로 유닛 테스트).
3. ✅ `app/api/similar/route.ts`·`lib/examples.ts` — bge-m3 쿼리 임베딩 + `embedding_version='bgem3-1024'` 게이팅 + 임계값 0.68. 임계값 상수는 `embedding-edge.ts`(`EDGE_SIMILARITY_THRESHOLD`)에 단일 출처. similar는 `embedding_v2 AS embedding` 별칭으로 `findSimilarTranslations`/`TranslationWithEmbedding` 무수정 재사용.
4. ✅ 백필: `lib/backfill.ts`(`backfillEmbeddingBatch` — `embedding_v2 IS NULL` 페이지 50, 행마다 `recordEdgeEmbedding` 재사용, 멱등, `{processed}` 반환) + `app/api/backfill/route.ts`(배치당 1회 POST, `{processed, remaining}` — `remaining=0`까지 반복 호출). Access 뒤라 별도 인증 불필요.
5. ✅ 테스트: `recordEdgeEmbedding`(임베딩→UPDATE 바인딩)·`backfillEmbeddingBatch`(페이지·멱등·빈셋)·버전/임계값 상수. 가짜 DB·`env.AI` 모킹. 총 96개 통과 + `next build`·lint·tsc 통과.

**배포 순서(중요):** `main` 푸시 → CI `deploy` 잡이 build → **D1 마이그레이션(0005, `wrangler d1 migrations apply --remote`) 자동 적용** → worker 배포까지 수행(수동 `db:migrate:prod` 불필요, 마이그레이션이 배포보다 먼저 실행됨). → 이후 **수동 1회성**으로 `POST /api/backfill` 반복(`remaining=0`까지, CI에 없고 라이브 AI 바인딩 필요) → 그때부터 `/api/similar` 활성. 로컬 dev만 `npm run db:migrate:local` 수동. 백필 전엔 버전 게이팅으로 유사검색이 빈 결과(의도됨: 마이그레이션 중 1536↔1024 공간 혼합 방지). P14 인라인은 Phase 2 옵트인까지 정적 예시 폴백(무회귀).

## 10. 계획 완성도 (단계별 — 명시적)
**모든 단계가 같은 깊이로 설계된 게 아님. 다음 단계만 구현 가능 수준.**

- **Phase 1 — ✅ 구현 완료(2026-06-26).** 마이그레이션 0005 + 임베딩 핫패스 분리(`ctx.waitUntil` 백그라운드 기록) + bge-m3 게이팅(0.68) + 멱등 백필 + 유닛 테스트. §9 참고. **남은 건 배포 후 실측 1회**(§6: bge-m3 한국어 품질·엣지 지연·임계값 실데이터 미세조정, `ctx.waitUntil` 백그라운드 기록 동작 확인).
- **Phase 2 — ✅ 상세 설계 완료(§11), 구현 대기.** §10에서 "구현 전 못 박을 것"으로 꼽은 5개(① 조회 계약 ② 패널 UX ③ `exampleIds` 흐름 ④ ⚠️W9 정합성 ⑤ 컷오프)를 §11에서 전부 확정. Phase 1 실측 결과(1068행·bge-m3·0.68 동작) 위에서 설계. **남은 건 §11.8 결정 5건 확인 → 구현.**
- **Phase 3 — ⚪ 보류된 옵션, 빌드 계획 없음(의도적).** 리서치 발견(§Q4, e5-small·WASM·2-모델 하이브리드)만 기록. **추진을 정하면 그때 상세 설계** — 지금은 미작성.

---

## 11. Phase 2 상세 설계 — as-you-type TM 패널 (2026-06-26)

> §10이 "구현 전 못 박을 것"으로 꼽은 5개를 Phase 1 실측(1068행·bge-m3·0.68 동작) 위에서 확정. **핵심 발견: Phase 1이 이미 `/api/similar`를 bge-m3·버전게이팅·0.68로 바꿔놨고, 그 응답이 매치별 `similarity`+`is_favorite`를 이미 포함** → Phase 2 백엔드는 원래 개요(§2/§7)보다 훨씬 작다. 백엔드 신규 표면은 사실상 `exampleIds` 처리 + 캐시 정합성뿐. as-you-type는 대부분 **클라 재배선**.

### 11.0 데이터 흐름 (확정)
```
[타이핑] ─(500ms 디바운스·≥3자·쿼리캐시·AbortController)→ POST /api/similar { text }
        → bge-m3 임베딩 + embedding_version='bgem3-1024' 스캔 + 0.68
        → { similar: [{id, korean_text, english_text, is_favorite, similarity, …}] }
        → TM 패널: 매치% + [이걸로 교체](모든 매치) + ☑[예시로 참고](즐겨찾기 매치만)
[예시 체크] → selectedExampleIds (현재 매치에 존재하는 id만 유지)
[번역하기] → POST /api/translate { koreanText, model, style, exampleIds:[…] }
        → exampleIds 있으면: W9 캐시 read 스킵(force-fresh) + id로 예시 조회·주입(임베딩 0)
        → 스트리밍(W7) → finalizeTranslation(had_examples = exampleIds?1:0)
        → 백그라운드 bge-m3 임베딩 기록 (Phase 1 그대로)
[plain 번역(예시 0)] → W9 캐시 read는 had_examples=0 행만 매치(예시본이 plain 캐시를 오염 못 함)
```

### 11.1 조회 엔드포인트 (gap ①) — `/api/similar` 그대로 재사용, 신규 라우트 없음
- **계약(이미 존재, 무변경):** `POST /api/similar { text }` → `{ similar: SimilarResult[] }`. `SimilarResult`는 행 전체 + `similarity`. `similarity` 내림차순 정렬, `findSimilarTranslations` limit=3.
- **신규 `/api/tm` 불필요:** 응답이 `is_favorite`+`similarity`를 이미 담아 패널이 필요로 하는 전부를 제공. `favoritesOnly` 파라미터도 **추가 안 함** — true로 좁히면 *비즐겨찾기 재사용 후보*(W6)가 사라짐. 전체를 스캔하고(1068행 코사인 ≈ 수 ms, 무시 가능) **체크박스만 `is_favorite`로 게이팅**.
- as-you-type는 **호출 시점**만 바뀜(번역 제출 시 → 타이핑 중 디바운스). 라우트는 그대로.

### 11.2 TM 패널 UX (gap ②)
- **배치:** 입력 폼 **아래, 결과 위**. 기존 `SimilarSuggestions`(결과 있을 때만 렌더)를 `TmPanel`로 확장 — **매치가 있으면 타이핑 중에도 표시**(`result` 게이트 제거). 번역 후에도 유지.
- **매치 카드:** `87% 유사` 뱃지 · 과거 한국어 · 과거 영어 · 우측에 두 어포던스:
  - **`이걸로 교체`** 버튼 — 모든 매치(재사용=W6, `handleUseSimilar` 그대로). 번역 없이 결과를 그 과거 번역으로 설정.
  - **`☑ 예시로 참고`** 체크박스 — **즐겨찾기 매치만 활성**(P14 ①: 예시는 즐겨찾기에서). 비즐겨찾기는 체크박스 숨김(재사용만 가능).
- **선택 요약줄:** 체크가 1개+이면 `예시 N개 적용 — 번역에 반영됩니다`.
- **로딩:** 조회 중 작은 스피너/`검색 중…`. **빈/짧은 입력(<3자):** 패널 `return null`(현재와 동일).
- **클라 메커니즘:** 디바운스 500ms · 최소 3자 · `Map<string, SimilarResult[]>` 쿼리캐시(백스페이스 재입력 시 재호출 0) · `AbortController`로 인플라이트 취소. (§0 관례)

### 11.3 `exampleIds` 흐름 (gap ③)
- **수집:** 패널 체크 → `selectedExampleIds: Set<string>`(page 상태). 매치 갱신 시 **현재 매치에 없는 id는 prune**(스테일 예시 방지).
- **전송:** `executeTranslation`이 `/api/translate` 바디에 `exampleIds: [...]` 추가(유사도 순). 빈 배열이면 Phase 1과 글자단위 동일(=정적 폴백, 무회귀).
- **주입(라우트):** `exampleIds` 비어있지 않으면 신규 `fetchExamplesByIds(db, ids, limit=3)`로 `SELECT id, korean_text, english_text FROM translations WHERE id IN (…)` → `FewShotExample[]` → 기존 `buildTranslationPrompt(…, examples)` 주입. **임베딩 0**(id 직접 조회). `EXAMPLE_LIMIT`(3)으로 캡, 프롬프트 크기 방어.
- **순수 함수 분리:** 선택/포맷은 이미 `lib/examples.ts`. 조회는 `fetchExamplesByIds`(주입 DB로 유닛 테스트).

### 11.4 ⚠️ W9 캐시 정합성 (gap ④) — `had_examples` 불리언 컬럼
- **트랩:** W9 키 = (정규화 텍스트, style, model). 예시 적용 여부가 키에 없으면 → "결제 확인"을 *예시 없이* 캐시 → 이후 *예시 체크 후* 같은 텍스트 요청이 **캐시 히트로 예시 무시**(역도 성립). Q1 글로서리와 동형 트랩.
- **불변식:** *plain(예시 0) 요청은 plain 번역만 반환. 예시 요청은 항상 fresh.*
- **확정 설계(최소·가역):**
  1. 마이그레이션 `0006_add_had_examples.sql`: `ALTER TABLE translations ADD COLUMN had_examples INTEGER NOT NULL DEFAULT 0`. (기존 행=0=plain, 정확.)
  2. `finalizeTranslation`에 `hadExamples` 추가 → INSERT 컬럼/바인딩 1개 확장.
  3. `findCachedTranslation` 조회에 `AND had_examples = 0` 추가 → **plain 요청은 plain 행만 매치**. 시그니처 무변경.
  4. 라우트: `exampleIds` 있으면 **캐시 read 스킵**(force-fresh) + `had_examples=1`로 저장.
- **반려한 대안:** (a) 무마이그레이션 = 예시본이 plain 요청에 새어나옴(불변식 위반). (b) 예시 id 집합 시그니처 컬럼으로 *정확 예시조합 캐싱* = 단일사용자 도구엔 과설계. → 불리언이 최소이면서 불변식 보장.
- **참고:** Q4의 `forceFresh`(같은 파라미터 강제 재번역)와 직교·양립. 예시 요청은 그 자체로 force-fresh.

### 11.5 임계값 동작 (gap ⑤) — 표시·주입 단일 0.68
- **단일 컷오프 0.68**(표시=주입). 주입이 **옵트인**(사용자가 직접 체크)이라 자동주입 안전장치용 별도 상한이 불필요. §8: 0.68 = "강한 매치만"(오탐 0). 약한 FYI 매치를 더 보고 싶다는 실사용 피드백이 오면 그때 *낮은 표시 컷오프*를 추가(후순위, 지금 미설계).
- **강한 매치(≥0.95 근사) 특별취급 안 함**(v1): 100% 텍스트 일치는 이미 W9가 처리. 0.68~1.0은 카드의 % 표기가 사용자 판단을 안내, 어포던스(교체/예시)는 동일. 티어드 동작은 후순위.

### 11.6 영향 파일 (Phase 2)
- **백엔드(소):** `migrations/0006_add_had_examples.sql`(신규) · `lib/translate-core.ts`(`hadExamples` 저장) · `lib/cache.ts`(`had_examples=0` 필터) · `lib/examples.ts`(`fetchExamplesByIds`) · `app/api/translate/route.ts`(`exampleIds` 수용·캐시 스킵·예시 주입·`had_examples` 저장). **`/api/similar` 무변경.**
- **프론트(중):** `components/TranslateForm.tsx`(`onDraftChange?` 추가, 가산) · `app/page.tsx`(디바운스·쿼리캐시·abort TM 조회 → `tmMatches`·`selectedExampleIds`, `exampleIds` 전달, 패널 상시 렌더) · `components/SimilarSuggestions.tsx` → `TmPanel`(체크박스 선택 props, 매치 있으면 렌더).

### 11.7 테스트 계획 (작업 규칙)
- **순수 유닛:** `fetchExamplesByIds`(가짜 DB — id 바인딩·limit 캡·빈셋) · `findCachedTranslation`의 `had_examples=0` 필터(바인딩/쿼리) · `finalizeTranslation`의 `had_examples` 바인딩 · `selectFewShotExamples`/`buildExamplesLine`(기존 유지, 차원무관).
- **클라 컴포넌트(jsdom+RTL+가짜 타이머):** 디바운스 500ms 후 1회 조회 · <3자 게이트 · 쿼리캐시(중복 fetch 0) · AbortController 취소 · 체크 토글 → `selectedExampleIds` · 번역 바디에 `exampleIds` 실림 · 패널 로딩/빈 상태 · 비즐겨찾기 체크박스 부재.
- **무회귀:** `exampleIds=[]`면 프롬프트·캐시 동작이 Phase 1과 동일함을 명시 테스트.

### 11.8 정해주실 결정 (Phase 2) — ✅ 확정 2026-06-26 (A~E 추천안 그대로 사인오프)
| # | 결정 | 추천 |
|---|------|------|
| A | 조회: `/api/similar` 재사용(무변경) vs 신규 `/api/tm` | **재사용** — 응답이 이미 충분(`is_favorite`+`similarity`), 표면 0 |
| B | W9 정합성: `had_examples` 불리언 컬럼(0006)+예시 force-fresh | **예** — 불변식 보장, 추가 컬럼 1개(가역·기본값 0) |
| C | 컷오프: 표시·주입 단일 0.68 | **단일** — 옵트인이라 분리 불필요, 후에 재검토 |
| D | 강한 매치 자동주입 vs 항상 옵트인 | **항상 옵트인** — 설계 일관·사용자 의도 |
| E | 예시 출처: 즐겨찾기 매치만 체크 가능(P14 ①) | **즐겨찾기만** — 비즐겨찾기는 재사용만 |

### 11.9 단계 분할 (독립 배포 가능한 PR)
1. ✅ **PR-a (백엔드, 무 UI 변화) — 구현 완료 2026-06-26.** 0006 마이그레이션(`had_examples`) + `finalizeTranslation` 저장 + `findCachedTranslation` `had_examples=0` 필터 + `fetchExamplesByIds`(id 조회·순서보존·캡) + 라우트 `exampleIds` 수용(없으면 무회귀: 캐시·프롬프트 Phase 1과 동일) + 예시요청 캐시 read 스킵. 유닛 테스트 +6(총 102) · lint·tsc·`next build` 통과. *클라가 아직 `exampleIds`를 안 보내므로 배포해도 동작 동일 — 안전 선행.*
2. ✅ **PR-b (프론트) — 구현 완료 2026-06-29.** `TranslateForm.onDraftChange`(가산) + page 디바운스(500ms·≥3자·쿼리캐시 `Map`·`AbortController`) TM 조회 + `SimilarSuggestions`→`TmPanel`(즐겨찾기만 `예시로 참고` 체크박스·`이걸로 교체`·로딩/빈 상태·매치 있으면 상시 렌더) + `selectedExampleIds`(매치 벗어나면 prune)→유사도순 `exampleIds` 전달. 컴포넌트 테스트 +10(TmPanel 7 + page 3: 디바운스 조회·<3자 게이트·예시 전달) = 총 112 · lint·tsc·`next build` 통과.
   - **무회귀 유지법:** TM 조회는 디바운스 타이핑 *및* 제출 시(쿼리캐시로 dedup) 둘 다 발동 → paste+즉시 Enter도 W6 제안이 뜸(기존 동작 보존). 기존 W6/자동복사/스트리밍 테스트 전부 통과.
→ PR-a를 먼저 머지하면 클라 없이도 스키마/라우트가 안전하게 준비됨(점진). 이제 PR-a+PR-b로 as-you-type TM 기능 활성.
