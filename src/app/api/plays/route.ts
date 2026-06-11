import { NextRequest, NextResponse } from 'next/server';
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

    const { gameId, date, location, notes, playerScores } = validatedData.data;

    // Phase 1: Create Play Session
    let playSession;
    try {
      playSession = await notionService.createPlaySession({
        gameId,
        date,
        location,
        notes,
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