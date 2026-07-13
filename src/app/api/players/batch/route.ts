import { NextRequest, NextResponse } from "next/server";

import { getPlayers, createPlayer } from "@/lib/notion";

/** Verify admin password from request body/params */
function isAdmin(req: NextRequest, body: { password?: string } | null): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  const password = body?.password || req.nextUrl.searchParams.get("password");
  return password === adminPassword;
}

/**
 * POST /api/players/batch
 *
 * Batch-create players in Notion Players DB.
 * Requires admin password (same as POST /api/players).
 *
 * Skips names that already exist in Notion (case-insensitive).
 * Creates only new names.
 * Special name "__verify__" is used for password validation only and is ignored.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!isAdmin(req, body)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const names: string[] = body?.names;
  if (!Array.isArray(names) || names.length === 0) {
    return NextResponse.json({ error: "names array is required" }, { status: 400 });
  }

  // Filter out the verification-only name
  const realNames = names.filter((n) => n.trim() !== "__verify__");
  if (realNames.length === 0) {
    // Only the verification call — password was already validated
    return NextResponse.json({ created: [], total: 0 });
  }

  try {
    // Get existing players from Notion
    const existingPlayers = await getPlayers();
    const existingNames = new Set(
      existingPlayers.map((p) => p.name.toLowerCase())
    );

    // Only create players that don't already exist
    const createdPlayers: { name: string; id: string }[] = [];
    for (const rawName of realNames) {
      const name = rawName.trim();
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) continue;

      try {
        const player = await createPlayer(name);
        createdPlayers.push(player);
        existingNames.add(name.toLowerCase()); // avoid duplicates within the same batch
      } catch {
        // Silently skip individual failures
      }
    }

    return NextResponse.json({
      created: createdPlayers,
      total: existingPlayers.length + createdPlayers.length,
    });
  } catch (error) {
    console.error("Failed to batch-create players:", error);
    return NextResponse.json(
      { error: "Failed to batch-create players" },
      { status: 500 }
    );
  }
}