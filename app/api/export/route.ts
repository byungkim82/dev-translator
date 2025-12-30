import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface Translation {
  id: string;
  korean_text: string;
  english_text: string;
  model: string;
  style: string;
  category: string | null;
  is_favorite: number;
  created_at: string;
}

export async function GET() {
  try {
    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    const result = await cfEnv.DB.prepare(
      `SELECT id, korean_text, english_text, model, style, category, is_favorite, created_at
       FROM translations
       ORDER BY created_at DESC`
    ).all<Translation>();

    const translations = result.results || [];

    // Generate CSV
    const headers = ["Timestamp", "Korean", "English", "Category", "Model", "Style", "Favorite"];
    const rows = translations.map((t) => [
      t.created_at,
      `"${t.korean_text.replace(/"/g, '""')}"`,
      `"${t.english_text.replace(/"/g, '""')}"`,
      t.category || "",
      t.model,
      t.style,
      t.is_favorite ? "Yes" : "No",
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    // Add BOM for Excel compatibility
    const csvWithBom = "\uFEFF" + csv;

    return new NextResponse(csvWithBom, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="translations_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "내보내기 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
