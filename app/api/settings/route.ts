import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface Settings {
  id: string;
  default_model: string;
  default_style: string;
  auto_copy: number;
}

interface Stats {
  total: number;
  thisWeek: number;
  uncategorized: number;
  favorites: number;
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    // Get settings
    const settings = await cfEnv.DB.prepare(
      "SELECT * FROM settings WHERE id = 'default'"
    ).first<Settings>();

    // Get stats
    const totalResult = await cfEnv.DB.prepare(
      "SELECT COUNT(*) as count FROM translations"
    ).first<{ count: number }>();

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekResult = await cfEnv.DB.prepare(
      "SELECT COUNT(*) as count FROM translations WHERE created_at > ?"
    )
      .bind(oneWeekAgo.toISOString())
      .first<{ count: number }>();

    const uncategorizedResult = await cfEnv.DB.prepare(
      "SELECT COUNT(*) as count FROM translations WHERE category IS NULL"
    ).first<{ count: number }>();

    const favoritesResult = await cfEnv.DB.prepare(
      "SELECT COUNT(*) as count FROM translations WHERE is_favorite = 1"
    ).first<{ count: number }>();

    const stats: Stats = {
      total: totalResult?.count || 0,
      thisWeek: weekResult?.count || 0,
      uncategorized: uncategorizedResult?.count || 0,
      favorites: favoritesResult?.count || 0,
    };

    return NextResponse.json({
      settings: settings || {
        default_model: "gemini-flash",
        default_style: "casual-work",
        auto_copy: 0,
      },
      stats,
    });
  } catch (error) {
    console.error("Settings fetch error:", error);
    return NextResponse.json(
      { error: "설정을 불러오는 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    const body = await request.json() as { default_model?: string; default_style?: string; auto_copy?: boolean | number };
    const { default_model, default_style, auto_copy } = body;

    const now = new Date().toISOString();

    await cfEnv.DB.prepare(
      `INSERT INTO settings (id, default_model, default_style, auto_copy, updated_at)
       VALUES ('default', ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         default_model = excluded.default_model,
         default_style = excluded.default_style,
         auto_copy = excluded.auto_copy,
         updated_at = excluded.updated_at`
    )
      .bind(
        default_model || "gemini-flash",
        default_style || "casual-work",
        auto_copy ? 1 : 0,
        now
      )
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json(
      { error: "설정 저장 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
