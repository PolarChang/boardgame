import { NextRequest, NextResponse } from "next/server";

import { createPlayer, getPlayers, deletePlayer } from "@/lib/notion";

export async function GET() {
  try {
    const players = await getPlayers();
    return NextResponse.json(players);
  } catch (error) {
    console.error("Failed to fetch players:", error);
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    );
  }
}

/** Verify admin password from request body/params */
function isAdmin(req: NextRequest, body: { password?: string } | null): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  const password = body?.password || req.nextUrl.searchParams.get("password");
  return password === adminPassword;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isAdmin(req, body)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  try {
    const player = await createPlayer(name);
    return NextResponse.json(player, { status: 201 });
  } catch (error) {
    console.error("Failed to create player:", error);
    return NextResponse.json(
      { error: "Failed to create player" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isAdmin(req, body)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const playerId = body?.playerId;
  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  try {
    await deletePlayer(playerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete player:", error);
    return NextResponse.json(
      { error: "Failed to delete player" },
      { status: 500 }
    );
  }
}

