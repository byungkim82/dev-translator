# 설계·구현 계획 — 영한(EN→KO) 읽기 기록 (Reading History)

> **F11(영어→한국어 읽기 모드) 후속 기능**의 상세 구현 계획 문서.
> **상태:** 설계 확정 (사인오프 완료) · 리뷰 반영(rev2) · 구현 미착수
> **작성:** 2026-07-03
> **rev2(2026-07-04) — 리뷰 반영:** ① 컬럼을 언어명(`english_text`/`korean_text` — `translations`와 역할이 반전) → **역할명 `source_text`/`target_text`** 로 rename(반전 자체를 불가능하게). ② **실스키마 round-trip 테스트(better-sqlite3)** 추가 — fake-DB 바인딩순서 테스트는 source/target 전치에 vacuous. ③ 저장을 done/close **이후 `ctx.waitUntil`** 로 이동(크리티컬 패스 밖 · KO→EN 백그라운드 임베딩과 동일 패턴). ④ **완전·비어있지 않은 결과만 저장**(truncated/빈 결과 제외). ⑤ 보존정책·페이지네이션 클램프·정렬 tiebreaker 명시.
> **진행 규칙:** 모든 변경은 테스트 동반(Vitest). 단순·저위험·additive 우선. 작동하는 앱(한→영·W9 캐시·P16 TM·F11 읽기)을 깨지 말 것.

---

## 0. 핵심 결정 — 완전 격리 (별도 테이블)

F11은 읽기 모드를 **일회성(ephemeral)** 으로 설계해 W9 캐시 방향 오염·컬럼 반전·TM 오염·스키마 트랩을 원천 차단했다. 이제 "기록 저장"을 추가하되 **그 격리를 깨지 않는다**: 읽기 기록을 공유 `translations` 테이블이 아니라 **전용 `reading_history` 테이블**에 넣는다.

→ 이 한 가지 결정으로 아래가 성립한다:

| 항목 | 결과 |
|---|---|
| W9 캐시 방향 오염(P16 트랩) | **애초에 안 생김** — 읽기행이 `translations`에 없으니 `findCachedTranslation`(`lib/cache.ts`: `FROM translations ... had_examples = 0`)이 볼 수 없음. 캐시 가드 불필요. |
| TM 코퍼스 오염 | 안 생김 — `/api/similar`는 `translations`만 조회. 읽기행은 임베딩도 안 함. |
| 통계/내보내기/카테고리 | 무영향 — 전부 `translations` 기준(§5). |
| 기존 히스토리 페이지 | 무영향 — 별도 페이지/API. |
| 컬럼 의미 반전 | **역할명 컬럼(`source_text`/`target_text`)으로 원천 차단**(§2, 리뷰 🔴1). |

**즉 한→영 앱은 글자 하나 안 바뀐다.** 유일한 서버 변경은 `/api/read`가 스트리밍 성공 후 로그 1행을 백그라운드로 추가하는 것뿐.

---

## 1. 확정된 결정

| # | 결정 | 확정안 |
|---|------|--------|
| **A** | 저장 위치 | **별도 `reading_history` 테이블**(공유 `translations` 아님). |
| **B** | UI 위치 | **새 네비 탭 "읽기 기록"** (`/reading-history`). 기존 히스토리와 분리. |
| **C** | 재사용 | **없음** — 임베딩/TM/few-shot/캐시 미연동. 순수 열람·삭제 로그. |
| **D** | 즐겨찾기/카테고리 | **없음** — 목록 카드엔 복사(한국어)·삭제만. |
| **E** | 중복 처리 | **요청마다 1행**(동일 영어 반복 허용). dedup 안 함. |
| **F** | 저장 시점 | done/close **이후** `ctx.waitUntil`로 백그라운드 저장(크리티컬 패스 밖). best-effort. (rev2 — 리뷰 🟠3) |
| **G** | 삭제 | 항목별 삭제 + **전체 삭제**. |
| **H** | 저장 조건 | **완전·비어있지 않은 결과만** 저장(`target.trim() && !truncated`). truncated/빈 출력은 미저장 → 부분-완결 혼입·쓰레기 행 방지. 사용자 화면엔 결과·잘림경고 그대로. (rev2 — 리뷰 🟠4) |
| **I** | 보존정책 | **무제한 · 전문 저장 · 길이 상한 없음 · GC는 수동 "전체 삭제"뿐** — 개인 단일사용자 짧은-메시지 읽기 로그라 수용 가능한 **의도된 선택**. (소프트캡이 필요해지면 저장 후 `DELETE FROM reading_history WHERE id NOT IN (SELECT id FROM reading_history ORDER BY created_at DESC LIMIT N)` 한 줄로 추가 — 지금은 안 함.) (rev2 — 리뷰 🟠5) |
| **J** | 컬럼 명명 | **역할 기반 `source_text`(영어 입력)·`target_text`(한국어 출력)**. `translations`의 `english_text`(출력)/`korean_text`(입력)와 이름이 겹쳐 역할이 반전되는 걸 피함. (rev2 — 리뷰 🔴1) |

---

## 2. 스키마 — 마이그레이션 `0007`

신규 파일 `migrations/0007_create_reading_history.sql`:

```sql
-- EN→KO reading-mode history (F11 follow-up). ISOLATED from the translations
-- table on purpose: keeps the KO→EN cache/TM/stats/history completely untouched
-- (see docs/reading-history-design.md, decision A). A disposable comprehension log.
--
-- Columns are ROLE-based (source/target), NOT language-based, on purpose: the
-- translations table already uses english_text=OUTPUT / korean_text=INPUT, and
-- reusing those names here (with inverted roles) is a known inversion trap. Here
-- source_text = the incoming English (input), target_text = the Korean output.
CREATE TABLE IF NOT EXISTS reading_history (
  id TEXT PRIMARY KEY,
  source_text TEXT NOT NULL,  -- incoming English (input)
  target_text TEXT NOT NULL,  -- Korean output
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reading_history_created_at ON reading_history(created_at DESC);
```

> 배포: `main` push 시 CI deploy 잡이 build → 마이그레이션(`--remote`) → worker 배포를 자동 수행(0005/0006과 동일). 로컬 dev만 `npm run db:migrate:local` 수동.
> ⚠️ **silent-failure 인지:** 0007 미적용/운영 중 D1 장애 시, `/api/read`의 저장은 §3.2 try/catch(`.catch`)로 삼켜져 **번역은 정상이지만 로그가 조용히 누락**(console.error는 tail 로그). 릴리스 시 §8 E2E("표시됨")로 걸리지만, 무증상 데이터 손실 가능성을 인지할 것.

---

## 3. 백엔드 (PR-a)

### 3.1 `lib/reading-history.ts` (신규) — 주입형 저장 헬퍼

`lib/cache.ts`·`lib/translate-core.ts`와 동일한 DI 방식. INSERT의 컬럼 순서/바인딩을 §3.4에서 **실스키마 round-trip**으로 검증.

```ts
// EN→KO reading-mode history (F11 follow-up). Isolated from the translations
// table so the KO→EN cache/TM/stats/history stay untouched. DB injected as a
// minimal interface for unit testing (same approach as lib/cache.ts).
//
// Role-based fields (source/target), NOT language names — see the migration
// comment and design decision J. source = incoming English, target = Korean.

export interface ReadingHistoryRow {
  id: string;
  source_text: string; // incoming English (input)
  target_text: string; // Korean output
  created_at: string;
}

export interface ReadingInsertDB {
  prepare(query: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
  };
}

const INSERT_SQL = `INSERT INTO reading_history (id, source_text, target_text, created_at)
   VALUES (?, ?, ?, ?)`;

export async function insertReadingHistory(
  db: ReadingInsertDB,
  row: ReadingHistoryRow
): Promise<void> {
  await db
    .prepare(INSERT_SQL)
    .bind(row.id, row.source_text, row.target_text, row.created_at)
    .run();
}
```

> list/delete는 `/api/history`가 라우트에서 인라인 쿼리하는 관례를 그대로 따라 라우트(§3.3)에 둔다. insert만 헬퍼로 빼서 §3.4에서 실스키마 검증.

### 3.2 `app/api/read/route.ts` (수정) — 성공 시 백그라운드 로그 1행

현재 `/api/read`는 스트리밍만 하고 아무것도 저장하지 않는다. **done을 보내고 스트림을 닫은 뒤**, `ctx.waitUntil`로 백그라운드에서 로그를 저장한다(크리티컬 패스 밖 — KO→EN 라우트가 bge-m3 임베딩을 `ctx.waitUntil(recordEdgeEmbedding(...))`로 처리하는 것과 동일 패턴).

**컨텍스트 구조분해 변경:**
```ts
// 현재: const { env } = await getCloudflareContext();
const { env, ctx } = await getCloudflareContext();  // ← ctx 추가
```

**추가 import:**
```ts
import { generateId } from "@/lib/utils";
import { insertReadingHistory } from "@/lib/reading-history";
```

**변경 지점** — 현재 코드:
```ts
          // done.english_text carries the final cleaned OUTPUT (Korean here). id and
          // created_at are empty — reading mode persists nothing.
          send({ type: "done", id: "", english_text: cleanGeminiOutput(full), truncated, created_at: "" });
          controller.close();
```
로 바꿔서:
```ts
          const koreanOutput = cleanGeminiOutput(full);

          // done.english_text carries the final cleaned OUTPUT (Korean here). id and
          // created_at stay empty — the client doesn't need the log row's id, and an
          // empty id keeps the reading result's favorite button disabled.
          send({ type: "done", id: "", english_text: koreanOutput, truncated, created_at: "" });
          controller.close();

          // Persist to the ISOLATED reading_history log AFTER closing the stream —
          // OFF the critical path (ctx.waitUntil keeps the worker alive past the
          // response, same as the KO→EN background embedding). Only COMPLETE, non-
          // empty results are logged (decision H): a truncated or empty read is
          // skipped to avoid partial-as-complete / empty junk rows. Best-effort — a
          // failed write just means no log (never breaks the translation). This is
          // the ONLY new write; it does NOT touch translations / W9 cache / TM /
          // embeddings. Trade-off: waitUntil can rarely drop the write on early
          // worker termination — acceptable for a disposable best-effort log.
          if (koreanOutput.trim() && !truncated) {
            ctx.waitUntil(
              insertReadingHistory(cfEnv.DB, {
                id: generateId(),
                source_text: englishText,
                target_text: koreanOutput,
                created_at: new Date().toISOString(),
              }).catch((e) => console.error("Reading-history persist failed:", e))
            );
          }
```

> `cfEnv`·`englishText`·`full`·`truncated`는 모두 `start(controller)` 클로저 스코프에 있음(현재 라우트가 `cfEnv.GEMINI_API_KEY`·`truncated`를 그렇게 쓰는 것과 동일).
> **불변식 유지:** done의 `id`/`created_at`는 계속 `""` → 메인 페이지 읽기 결과의 즐겨찾기 버튼은 기존 `streaming || !translation.id`로 여전히 비활성(클라 무변경).

### 3.3 `app/api/reading-history/route.ts` (신규) — 목록/삭제

`/api/history`의 GET·DELETE 패턴을 미러링하되 필터·favorite·category 없이 단순화. 페이지네이션 입력은 **클램프**(리뷰 🟡), 정렬은 **동일-ms tiebreaker** 포함.

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface ReadingEntry {
  id: string;
  source_text: string;
  target_text: string;
  created_at: string;
}

// GET - list reading history (newest first, paginated)
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    const sp = request.nextUrl.searchParams;
    // Clamp so a bad limit/page can't request an unbounded fetch or a negative offset.
    const page = Math.max(1, parseInt(sp.get("page") || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "20") || 20));
    const offset = (page - 1) * limit;

    const result = await cfEnv.DB.prepare(
      "SELECT id, source_text, target_text, created_at FROM reading_history ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?"
    )
      .bind(limit, offset)
      .all<ReadingEntry>();

    const countRow = await cfEnv.DB.prepare(
      "SELECT COUNT(*) as count FROM reading_history"
    ).first<{ count: number }>();
    const total = countRow?.count || 0;

    return NextResponse.json({
      entries: result.results || [],
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error("Reading-history fetch error:", error);
    return NextResponse.json(
      { error: "읽기 기록을 불러오는 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// DELETE - delete one entry by id, or all with { all: true }
export async function DELETE(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    const body = (await request.json()) as { id?: string; all?: boolean };

    if (body.all) {
      await cfEnv.DB.prepare("DELETE FROM reading_history").run();
      return NextResponse.json({ success: true });
    }
    if (!body.id) {
      return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });
    }
    await cfEnv.DB.prepare("DELETE FROM reading_history WHERE id = ?")
      .bind(body.id)
      .run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reading-history delete error:", error);
    return NextResponse.json({ error: "삭제 중 오류가 발생했습니다" }, { status: 500 });
  }
}
```

### 3.4 PR-a 테스트 — ⚠️ 실스키마 round-trip 필수

**`lib/reading-history.test.ts`** (신규). 여기서 핵심은 리뷰 🔴2다: **fake-DB로 바인딩 *순서*만 단언하면 `source_text`↔`target_text` 전치(swap)나 SQL 컬럼↔바인딩 불일치를 못 잡는다**(둘 다 string이라 타입도 안 걸림 = 이 프로젝트에서 가장 위험한 버그 클래스가 vacuous pass). 그래서 **실제 SQLite에 실제 마이그레이션 SQL을 적용해 INSERT→SELECT 왕복**으로 검증한다.

- devDependency 추가: `better-sqlite3`(+`@types/better-sqlite3`). *(대안: Node 22의 내장 `node:sqlite`. 표준·안정성 위해 better-sqlite3 권장.)*
- vitest는 이 파일에서 node 환경(T18 기본) + 프로젝트 루트 cwd라 마이그레이션 파일을 상대경로로 읽는다.

```ts
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { insertReadingHistory, type ReadingInsertDB } from "./reading-history";

// Adapt synchronous better-sqlite3 to the async D1-like ReadingInsertDB interface.
function adapt(db: Database.Database): ReadingInsertDB {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return { bind: (...values: unknown[]) => ({ run: async () => stmt.run(...values) }) };
    },
  };
}

describe("insertReadingHistory (real-schema round-trip)", () => {
  it("stores source (English input) and target (Korean output) in the right columns", async () => {
    const db = new Database(":memory:");
    // Apply the ACTUAL migration so the test fails if the schema/columns drift.
    db.exec(readFileSync("migrations/0007_create_reading_history.sql", "utf8"));

    await insertReadingHistory(adapt(db), {
      id: "r1",
      source_text: "Hey, can you check this PR?",
      target_text: "이 PR 확인해줄 수 있어?",
      created_at: "2026-07-04T00:00:00.000Z",
    });

    const row = db
      .prepare("SELECT source_text, target_text FROM reading_history WHERE id = ?")
      .get("r1") as { source_text: string; target_text: string };

    // Discriminating: a source/target swap OR a SQL/bind column mismatch fails here.
    expect(row.source_text).toBe("Hey, can you check this PR?");
    expect(row.target_text).toBe("이 PR 확인해줄 수 있어?");
  });
});
```

> 부수효과: 이 테스트가 프로젝트 최초의 **실-DB 테스트 인프라**를 도입한다(현재 전부 fake-DB). T18이 예고한 "D1 연동 테스트 확대"의 명분이자 시작점 — 이후 D1 스키마를 만지는 테스트가 `adapt()` 패턴을 재사용할 수 있다.
> 라우트(`/api/read`·`/api/reading-history`)는 Workers 풀 없이는 라우트 단위 테스트를 안 하는 기존 정책과 동일 — 저장 헬퍼 round-trip + PR-b 페이지 컴포넌트 테스트 + 배포 후 수동 E2E(§8)로 커버.

---

## 4. 프론트 (PR-b)

### 4.1 `components/Navigation.tsx` (수정) — 탭 추가
```ts
const tabs = [
  { href: "/", label: "번역" },
  { href: "/history", label: "히스토리" },
  { href: "/reading-history", label: "읽기 기록" }, // ← 추가
  { href: "/settings", label: "설정" },
];
```
> ℹ️ 탭이 4개가 되며 `flex-1` 균등분할이라 각 탭이 좁아짐(`Navigation.tsx:23`). 라벨이 짧아(번역/히스토리/읽기 기록/설정) 데스크톱은 무난하나 **좁은 모바일 폭에서 줄바꿈/찌그러짐 육안 확인** 권장.

### 4.2 `components/ReadingHistoryCard.tsx` (신규)
`HistoryCard`를 단순화(즐겨찾기·카테고리·스타일 없음). source(영어)→target(한국어) 방향으로 표시, 복사는 **한국어(target)**, 삭제는 confirm.

```tsx
"use client";

import { formatDate } from "@/lib/utils";

export interface ReadingEntry {
  id: string;
  source_text: string; // incoming English (input)
  target_text: string; // Korean output
  created_at: string;
}

interface ReadingHistoryCardProps {
  entry: ReadingEntry;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}

export function ReadingHistoryCard({ entry, onCopy, onDelete }: ReadingHistoryCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary hover:shadow-sm transition-all">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">영 → 한</span>
      </div>

      <div className="mb-3">
        <div className="text-sm text-gray-500 mb-1 line-clamp-2">{entry.source_text}</div>
        <div className="text-sm font-medium text-gray-900 pl-3 border-l-2 border-primary line-clamp-3">
          {entry.target_text}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          onClick={() => onCopy(entry.target_text)}
          className="p-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          title="한국어 복사"
        >
          📋
        </button>
        <button
          onClick={() => {
            if (confirm("정말 삭제하시겠습니까?")) onDelete(entry.id);
          }}
          className="p-2 border border-gray-200 rounded hover:bg-red-50 hover:border-red-200 transition-colors"
          title="삭제"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
```

### 4.3 `app/reading-history/page.tsx` (신규)
`app/history/page.tsx`를 단순화(필터/즐겨찾기/카테고리/CSV 없음). 목록 + 삭제 + "더 보기" + "전체 삭제" + 빈 상태 + 토스트.

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ReadingHistoryCard, type ReadingEntry } from "@/components/ReadingHistoryCard";
import { Toast } from "@/components/Toast";

interface ReadingHistoryResponse {
  entries: ReadingEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export default function ReadingHistoryPage() {
  const [entries, setEntries] = useState<ReadingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPage = useCallback(async (pageNum: number, append = false) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/reading-history?page=${pageNum}&limit=20`);
      if (!res.ok) throw new Error("failed");
      const data: ReadingHistoryResponse = await res.json();
      setEntries((prev) => (append ? [...prev, ...data.entries] : data.entries));
      setHasMore(data.hasMore);
      setTotal(data.total);
    } catch {
      showToast("읽기 기록을 불러오지 못했습니다", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(1);
    fetchPage(1, false);
  }, [fetchPage]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("복사되었습니다!", "success");
    } catch {
      showToast("복사에 실패했습니다", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch("/api/reading-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      showToast("삭제되었습니다", "success");
    } catch {
      showToast("삭제 실패", "error");
    }
  };

  const handleClearAll = async () => {
    if (!confirm("읽기 기록을 전체 삭제할까요?")) return;
    try {
      await fetch("/api/reading-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setEntries([]);
      setTotal(0);
      showToast("전체 삭제되었습니다", "success");
    } catch {
      showToast("삭제 실패", "error");
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">
          읽기 기록 <span className="text-gray-400 font-normal">({total}개)</span>
        </h2>
        {total > 0 && (
          <button
            onClick={handleClearAll}
            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-red-50 transition-colors"
          >
            전체 삭제
          </button>
        )}
      </div>

      {isLoading && entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <span className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-2">로딩 중...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>읽기 기록이 없습니다.</p>
          <p className="text-sm mt-1">번역 탭에서 &quot;영어 → 한국어&quot;로 읽어보세요!</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {entries.map((entry) => (
              <ReadingHistoryCard
                key={entry.id}
                entry={entry}
                onCopy={handleCopy}
                onDelete={handleDelete}
              />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="w-full mt-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {isLoading ? "로딩 중..." : "더 보기"}
            </button>
          )}
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
```

### 4.4 PR-b 테스트
- **`components/ReadingHistoryCard.test.tsx`** (신규, jsdom+RTL):
  - `source_text`·`target_text`·날짜 렌더.
  - 복사 클릭 → `onCopy(entry.target_text)`(=한국어).
  - 삭제: `vi.stubGlobal("confirm", () => true)` → 클릭 시 `onDelete(entry.id)`. (confirm=false면 미호출 케이스도 1개.)
- **`app/reading-history/page.test.tsx`** (신규, jsdom+RTL):
  - `fetch` 모킹으로 `/api/reading-history` GET가 entries 반환 → 항목 렌더.
  - 삭제 클릭(confirm=true) → DELETE 호출 + 목록에서 사라짐.
  - 빈 응답 → 빈 상태 문구.

---

## 5. 손대지 않는 것 (격리 보장)

| 미변경 | 이유 |
|---|---|
| `translations` 테이블·스키마 | 읽기행은 `reading_history`에만. |
| W9 캐시 (`lib/cache.ts`) | 읽기행이 `translations`에 없어 조회 대상 아님 → 방향 오염 불가. |
| TM (`app/api/similar/route.ts`, `lib/examples.ts`, 임베딩) | 읽기행 임베딩 안 함 + 별도 테이블. |
| `/api/history`, `app/history/page.tsx` | 별도 페이지/API. |
| `/api/settings`(통계), `/api/export`, `/api/categorize` | 전부 `translations` 기준 → 카운트/CSV/카테고리에 읽기행 안 섞임. |
| 메인 페이지(`app/page.tsx`·`TranslateForm`·`TranslationResult`) | `/api/read` 응답 계약(done id="") 불변 → 클라 무변경. |
| `lib/translate-core.ts`(`finalizeTranslation`·`recordEdgeEmbedding`) | 읽기 저장은 별도 `insertReadingHistory` 사용. |

---

## 6. 트랩 체크리스트

- ⚠️ **격리 위반 금지:** `/api/read`는 반드시 `reading_history`에만 저장. `translations` INSERT·`finalizeTranslation`·`recordEdgeEmbedding`를 절대 호출하지 말 것(그러면 W9/TM 오염 부활).
- ⚠️ **컬럼 반전:** `source_text`(영어 입력)·`target_text`(한국어 출력) 역할명을 지킬 것. `translations`의 `english_text`(출력)/`korean_text`(입력) 멘탈모델을 여기 적용하면 반대다 → §3.4 **실스키마 round-trip 테스트가 유일한 판별 방어**(fake-DB 바인딩순서 테스트는 전치에 vacuous). 이 테스트를 빼면 안 됨.
- ⚠️ **best-effort + 완전결과만:** 저장은 `ctx.waitUntil` + `.catch`(스트림 무영향) + `if (target.trim() && !truncated)`(부분/빈 결과 미저장).
- ⚠️ **done 계약 불변:** done의 `id`/`created_at`는 `""` 유지 → 메인 페이지 읽기 결과 즐겨찾기 비활성 로직(`!translation.id`) 그대로. 로그 행 id를 클라로 보내지 말 것.
- ℹ️ **크리티컬 패스:** 저장은 done/close **이후** `ctx.waitUntil`(응답 지연 0). inline await로 되돌리지 말 것.
- ℹ️ **복사 대상:** 읽기 카드 복사는 **한국어(target)**.

---

## 7. PR 분할·순서·커밋

| 순서 | 내용 | 사용자 화면 영향 | 커밋(예) |
|:---:|------|------|------|
| **PR-a** | 마이그레이션 0007 + `lib/reading-history.ts` + **실스키마 round-trip 테스트(better-sqlite3 devDep)** + `/api/read` 백그라운드 저장 + `/api/reading-history` 라우트 | 없음(로그만 쌓임, 볼 UI 아직 없음 → 무해) | `feat: reading-history backend — isolated reading_history table + waitUntil persist` |
| **PR-b** | 네비 탭 + `app/reading-history/page.tsx` + `ReadingHistoryCard`(+테스트) | "읽기 기록" 탭 노출 | `feat: reading-history UI — 읽기 기록 tab (list + delete)` |

각 PR 머지 조건: `npm run test:run`·`npm run lint`·`npx tsc --noEmit`·`npm run build` 통과.
**PR-a 시작 시:** `docs/IMPROVEMENTS.md`에 백로그 행 추가(예: `F14 · 영한 읽기 기록`) + 본 문서 링크 + 상태 🚧.

---

## 8. 배포 후 수동 E2E (PR-b 후)

- [ ] "영어 → 한국어"로 영어 문장 번역 → **"읽기 기록" 탭에 영어→한국어·날짜로 표시**(source/target 방향·복사 대상 한국어 육안 확인 = 컬럼 반전 최종 방어).
- [ ] 항목 삭제(휴지통) → 확인창 후 목록에서 사라짐.
- [ ] "전체 삭제" → 빈 상태 문구.
- [ ] 20개 초과 시 "더 보기" 동작.
- [ ] **격리 확인:** 한→영 번역 몇 건 후 `/history`(한→영 히스토리)·설정 통계에 **읽기 행이 안 섞임**. W9 캐시·TM 정상(한→영 재번역·유사 패널 영향 없음).
- [ ] 읽기 결과 카드의 즐겨찾기 버튼 여전히 **비활성**.
- [ ] 4개 탭 모바일 폭 확인.

---

## 9. 영향 파일 (요약)

**신규:** `migrations/0007_create_reading_history.sql`, `lib/reading-history.ts`(+`.test.ts` 실-DB round-trip), `app/api/reading-history/route.ts`, `app/reading-history/page.tsx`(+`.test.tsx`), `components/ReadingHistoryCard.tsx`(+`.test.tsx`), 본 문서.
**수정:** `app/api/read/route.ts`(ctx 구조분해 + waitUntil 저장), `components/Navigation.tsx`(탭 1개), `docs/IMPROVEMENTS.md`(백로그 행+🚧), `package.json`(devDep `better-sqlite3`).
**미변경(중요):** `app/api/translate/route.ts`, `app/api/similar/route.ts`, `app/api/history/route.ts`, `app/api/settings/route.ts`, `app/api/export/route.ts`, `lib/cache.ts`, `lib/examples.ts`, `lib/translate-core.ts`, `app/page.tsx`, `components/TranslateForm.tsx`, `components/TranslationResult.tsx`, `translations` 테이블.
