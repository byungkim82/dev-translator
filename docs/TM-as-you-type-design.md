# 설계안 — As-you-type 번역 메모리 (Translation Memory)

> **상태:** 설계 검토 중 (구현 미착수)
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

## 9. 다음 세션 시작점 — Phase 1 체크리스트
이미 완료(커밋됨): `[ai]` 바인딩, `env.AI` 타입, `lib/ai/embedding-edge.ts`(+테스트). 모델·임계값 확정(§8).
**Phase 1 남은 작업** (확정 파라미터: 모델 `@cf/baai/bge-m3`, 차원 1024, 버전태그 `bgem3-1024`, 임계값 0.68):
1. `migrations/0005_add_embedding_version.sql` — `embedding_version TEXT`, `embedding_v2 TEXT` 추가(기존 `embedding` 보존).
2. `app/api/translate/route.ts` — 인라인 임베딩 제거 → 스트림 종료 후 백그라운드로 bge-m3 임베딩을 `embedding_v2`+버전 저장(번역 비차단). **→ 1.3s 블록 제거.**
3. `app/api/similar/route.ts`·`lib/examples.ts` — bge-m3·`embedding_version='bgem3-1024'` 게이팅, 임계값 0.68.
4. 기존 코퍼스 백필 스크립트(50~100행 페이지, 작아서 일회성).
5. 테스트: 버전 게이팅·백그라운드 임베딩 경로(가짜 DB·`env.AI` 모킹).

## 10. 계획 완성도 (단계별 — 명시적)
**모든 단계가 같은 깊이로 설계된 게 아님. 다음 단계만 구현 가능 수준.**

- **Phase 1 — ✅ 구현 준비 완료.** 모델·임계값·차원·버전태그 확정(§8), §9에 파일 단위 체크리스트, 기반 커밋됨. 바로 착수 가능.
- **Phase 2 — 🟡 방향·스텝은 있으나 착수 전 "상세 설계 1회" 필요.** §2의 Phase 2는 *개요*일 뿐, 아래는 **아직 미설계 — 구현 전 못 박을 것**:
  1. `/api/tm` **요청/응답 계약**(정확한 형태·매치 정렬·반환 필드).
  2. **TM 패널 UX** — 매치 표시 방식, 옵트인 체크, 일치율 표기, 빈/로딩 상태.
  3. **`exampleIds` 흐름** — 패널 선택 → 번역 요청 → id로 예시 조회·주입(임베딩 없이)의 구체 경로.
  4. ⚠️ **W9 캐시 키에 "예시 적용 여부" 반영 설계** — Q1 글로서리 때와 같은 *캐시 정합성 트랩*. §2엔 "반영"이라고만 적혀 있고 설계는 안 됨.
  5. **임계값(0.68)의 패널 동작** — 표시 컷오프 vs 주입 컷오프 분리 여부.
  → Phase 1 결과(bge-m3 실동작·코퍼스)를 본 뒤 상세화하는 게 정확함.
- **Phase 3 — ⚪ 보류된 옵션, 빌드 계획 없음(의도적).** 리서치 발견(§Q4, e5-small·WASM·2-모델 하이브리드)만 기록. **추진을 정하면 그때 상세 설계** — 지금은 미작성.
