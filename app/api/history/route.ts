import { NextRequest, NextResponse } from "next/server";
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

// GET - List translations with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const style = searchParams.get("style") || "";
    const favorite = searchParams.get("favorite") === "true";
    const sort = searchParams.get("sort") || "newest";

    const offset = (page - 1) * limit;

    // Build query with filters
    let query = "SELECT id, korean_text, english_text, model, style, category, is_favorite, created_at FROM translations WHERE 1=1";
    const params: (string | number)[] = [];

    if (search) {
      query += " AND (korean_text LIKE ? OR english_text LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      query += " AND category = ?";
      params.push(category);
    }

    if (style) {
      query += " AND style = ?";
      params.push(style);
    }

    if (favorite) {
      query += " AND is_favorite = 1";
    }

    // Sort
    if (sort === "oldest") {
      query += " ORDER BY created_at ASC";
    } else if (sort === "alphabetical") {
      query += " ORDER BY korean_text ASC";
    } else {
      query += " ORDER BY created_at DESC";
    }

    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const stmt = cfEnv.DB.prepare(query);
    const result = await stmt.bind(...params).all<Translation>();

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as count FROM translations WHERE 1=1";
    const countParams: (string | number)[] = [];

    if (search) {
      countQuery += " AND (korean_text LIKE ? OR english_text LIKE ?)";
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      countQuery += " AND category = ?";
      countParams.push(category);
    }

    if (style) {
      countQuery += " AND style = ?";
      countParams.push(style);
    }

    if (favorite) {
      countQuery += " AND is_favorite = 1";
    }

    const countStmt = cfEnv.DB.prepare(countQuery);
    const countResult = await countStmt.bind(...countParams).first<{ count: number }>();

    return NextResponse.json({
      translations: result.results || [],
      total: countResult?.count || 0,
      page,
      limit,
      hasMore: offset + limit < (countResult?.count || 0),
    });
  } catch (error) {
    console.error("History fetch error:", error);
    return NextResponse.json(
      { error: "히스토리를 불러오는 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// PATCH - Update translation (favorite, category, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    const body = await request.json() as { id?: string; is_favorite?: boolean; category?: string };
    const { id, is_favorite, category } = body;

    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });
    }

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (typeof is_favorite === "boolean") {
      updates.push("is_favorite = ?");
      params.push(is_favorite ? 1 : 0);
    }

    if (category !== undefined) {
      updates.push("category = ?");
      params.push(category);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "업데이트할 필드가 없습니다" }, { status: 400 });
    }

    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(id);

    await cfEnv.DB.prepare(
      `UPDATE translations SET ${updates.join(", ")} WHERE id = ?`
    )
      .bind(...params)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("History update error:", error);
    return NextResponse.json(
      { error: "업데이트 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// DELETE - Delete translation
export async function DELETE(request: NextRequest) {
  try {
    const { env } = await getCloudflareContext();
    const cfEnv = env as CloudflareEnv;

    const body = await request.json() as { id?: string };
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다" }, { status: 400 });
    }

    await cfEnv.DB.prepare("DELETE FROM translations WHERE id = ?")
      .bind(id)
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("History delete error:", error);
    return NextResponse.json(
      { error: "삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
