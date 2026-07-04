import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { insertReadingHistory, type ReadingInsertDB } from "./reading-history";

// Adapt synchronous better-sqlite3 to the async D1-like ReadingInsertDB interface,
// so insertReadingHistory can run against a REAL schema (not a fake DB that can't
// catch a source/target column swap — both are strings, so a swap is type-safe and
// invisible to a bind-order-only assertion).
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
      .prepare("SELECT source_text, target_text, created_at FROM reading_history WHERE id = ?")
      .get("r1") as { source_text: string; target_text: string; created_at: string };

    // Discriminating: a source/target swap OR a SQL/bind column mismatch fails here.
    expect(row.source_text).toBe("Hey, can you check this PR?");
    expect(row.target_text).toBe("이 PR 확인해줄 수 있어?");
    expect(row.created_at).toBe("2026-07-04T00:00:00.000Z");
  });
});
