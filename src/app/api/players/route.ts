import { NextRequest, NextResponse } from "next/server";

import { createPlayer, getPlayers } from "@/lib/notion";

export async function GET() {
  const players = await getPlayers();
  return NextResponse.json(players);
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
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password || password !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!name) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const player = await createPlayer(name);
  return NextResponse.json(player, { status: 201 });
}

