import { NextResponse } from "next/server";

const RULES_API_URL = process.env.BOARDGAME_RULES_API_URL || "http://localhost:8000";
const RULES_API_KEY = process.env.RULES_API_KEY;

export async function POST(
  request: Request,
  context: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await context.params;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || typeof file === "string" || !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "A PDF file is required" }, { status: 400 });
  }

  const upstreamForm = new FormData();
  upstreamForm.set("file", file, file.name);
  for (const field of ["version", "language"]) {
    const value = formData?.get(field);
    if (typeof value === "string" && value.trim()) upstreamForm.set(field, value.trim());
  }

  try {
    const response = await fetch(
      `${RULES_API_URL}/api/knowledge/games/${encodeURIComponent(gameId)}/rulebooks`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(RULES_API_KEY ? { "X-Rules-API-Key": RULES_API_KEY } : {}),
        },
        body: upstreamForm,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Rules knowledge API error: ${response.status}`, detail: await response.text() },
        { status: response.status },
      );
    }

    return NextResponse.json(await response.json());
  } catch (error) {
    console.error("Failed to proxy rulebook upload:", error);
    return NextResponse.json({ error: "Failed to connect to rules knowledge service" }, { status: 502 });
  }
}
