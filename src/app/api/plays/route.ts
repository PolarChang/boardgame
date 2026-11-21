import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { PlayRecordSchema } from '@/lib/play-schema';
import * as notionService from '@/lib/notion';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId') ?? undefined;
  const plays = await notionService.getGamePlays(gameId);
  return NextResponse.json(plays);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = PlayRecordSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: validatedData.error.issues },
        { status: 400 }
      );
    }

    const { gameId, date, location, notes, playerScores, gatheringPageId } = validatedData.data;
    if (gatheringPageId) {
      const expected = process.env.ADMIN_PASSWORD;
      const supplied = req.headers.get("x-boardgame-admin");
      if (!expected || !supplied || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
          !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
        return NextResponse.json({ error: "請先登入管理員以關聯聚會" }, { status: 401 });
      }
    }

    // Phase 1: Create Play Session
    let playSession;
    try {
      playSession = await notionService.createPlaySession({
        gameId,
        date,
        location,
        notes,
        ...(gatheringPageId ? { gatheringPageId } : {}),
      });
    } catch (error) {
      console.error('Failed to create play session:', error);
      return NextResponse.json(
        { error: 'Failed to create play session' },
        { status: 500 }
      );
    }

    // Phase 2: Create Player Scores
    try {
      await Promise.all(
        playerScores.map((score) =>
          notionService.createPlayerScore({
            playId: playSession.id,
            ...score,
          })
        )
      );
    } catch (error) {
      console.error('Failed to create player scores:', error);
      await notionService.deletePlaySession(playSession.id);
      return NextResponse.json(
        { error: 'Failed to create player scores' },
        { status: 500 }
      );
    }

    // Invalidate dashboard cache so new data shows up immediately
    notionService.invalidateDashboardCache();

    return NextResponse.json({ id: playSession.id }, { status: 201 });
  } catch (error) {
    console.error('Internal Server Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    await notionService.deletePlaySession(id);

    // Invalidate dashboard cache
    notionService.invalidateDashboardCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete play session:', error);
    return NextResponse.json(
      { error: 'Failed to delete play session' },
      { status: 500 }
    );
  }
}
