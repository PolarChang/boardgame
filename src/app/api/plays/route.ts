import { NextRequest, NextResponse } from "next/server";

import { createPlayRecord, getGamePlays } from "@/lib/notion";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId") ?? undefined;

  const records = await getGamePlays(gameId || undefined);
  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);

  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gameId = typeof body?.gameId === "string" ? body.gameId.trim() : "";
  const date = typeof body?.date === "string" ? body.date.trim() : "";
  const playerIds = Array.isArray(body?.playerIds)
    ? body.playerIds.filter((id: unknown) => typeof id === "string" && id.trim())
    : [];
  const scores = typeof body?.scores === "string" ? body.scores : "";

  if (!gameId || !date || playerIds.length === 0) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400 }
    );
  }

  const record = await createPlayRecord({ gameId, date, playerIds, scores });
  return NextResponse.json(record, { status: 201 });
}

