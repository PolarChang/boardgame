import { NextResponse } from 'next/server';
import { getDetailedPlayLogs } from '@/lib/notion';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const logs = await getDetailedPlayLogs();
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch dashboard play logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch play logs' },
      { status: 500 }
    );
  }
}