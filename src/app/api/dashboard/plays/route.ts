import { NextRequest, NextResponse } from 'next/server';
import { getDetailedPlayLogs, invalidateDashboardCache } from '@/lib/notion';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Support cache-busting via ?refresh=true
  const { searchParams } = new URL(req.url);
  if (searchParams.get('refresh') === 'true') {
    invalidateDashboardCache();
  }

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
