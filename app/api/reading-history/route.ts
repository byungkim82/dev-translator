import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// EN→KO reading history (F11 follow-up). Reads/deletes the isolated reading_history
// table — completely separate from the KO→EN translations table (see
// docs/reading-history-design.md). Role-based columns: source_text = English input,
// target_text = Korean output.
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
