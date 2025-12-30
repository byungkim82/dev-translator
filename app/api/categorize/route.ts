import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { callGemini } from "@/lib/ai/gemini";
import { buildCategorizationPrompt } from "@/lib/prompts";

interface Translation {
  id: string;
  korean_text: string;
  english_text: string;
}

interface CategoryResult {
  id: string;
  category: string;
}

export async function POST() {
  try {
    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    if (!cfEnv.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    // Get uncategorized translations
    const result = await cfEnv.DB.prepare(
      `SELECT id, korean_text, english_text
       FROM translations
       WHERE category IS NULL
       LIMIT 50`
    ).all<Translation>();

    if (!result.results || result.results.length === 0) {
      return NextResponse.json({ message: "분류할 항목이 없습니다", count: 0 });
    }

    const translations = result.results;
    const prompt = buildCategorizationPrompt(translations);

    // Call Gemini for categorization
    const response = await callGemini(prompt, cfEnv.GEMINI_API_KEY);

    // Parse JSON response
    let categories: CategoryResult[];
    try {
      // Remove markdown code blocks if present
      const cleanResponse = response.replace(/```json\n?|\n?```/g, "").trim();
      categories = JSON.parse(cleanResponse) as CategoryResult[];
    } catch {
      console.error("Failed to parse categorization response:", response);
      return NextResponse.json(
        { error: "카테고리 분류 응답을 파싱할 수 없습니다" },
        { status: 500 }
      );
    }

    // Update database
    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const item of categories) {
      try {
        await cfEnv.DB.prepare(
          `UPDATE translations SET category = ?, updated_at = ? WHERE id = ?`
        )
          .bind(item.category, now, item.id)
          .run();
        updatedCount++;
      } catch (e) {
        console.error(`Failed to update category for ${item.id}:`, e);
      }
    }

    return NextResponse.json({
      message: `${updatedCount}개 항목을 분류했습니다`,
      count: updatedCount,
    });
  } catch (error) {
    console.error("Categorization error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "카테고리 분류 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
