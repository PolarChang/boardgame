import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/plays/route';
import * as notionService from '@/lib/notion';
import { NextRequest } from 'next/server';

// Mock the notion service
vi.mock('@/lib/notion', () => ({
  createPlaySession: vi.fn(),
  createPlayerScore: vi.fn(),
  deletePlaySession: vi.fn(),
}));

describe('POST /api/plays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 201 when payload is valid', async () => {
    const payload = {
      gameId: 'game-123',
      date: '2026-06-07',
      location: 'Home',
      notes: 'Great game',
      playerScores: [
        { playerId: 'player-1', score: 10, isWinner: true, firstPlay: false },
      ],
    };

    vi.mocked(notionService.createPlaySession).mockResolvedValue({ id: 'play-123' } as any);
    vi.mocked(notionService.createPlayerScore).mockResolvedValue({ id: 'score-123' } as any);

    const req = new NextRequest('http://localhost/api/plays', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);
    expect(notionService.createPlaySession).toHaveBeenCalledTimes(1);
    expect(notionService.createPlayerScore).toHaveBeenCalledTimes(1);
  });

  it('should return 400 when playerScores is empty', async () => {
    const payload = {
      gameId: 'game-123',
      date: '2026-06-07',
      location: 'Home',
      playerScores: [],
    };

    const req = new NextRequest('http://localhost/api/plays', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(notionService.createPlaySession).not.toHaveBeenCalled();
  });

  it('should return 500 when phase 2 fails', async () => {
    const payload = {
      gameId: 'game-123',
      date: '2026-06-07',
      location: 'Home',
      playerScores: [{ playerId: 'player-1', score: 10, isWinner: true, firstPlay: false }],
    };

    vi.mocked(notionService.createPlaySession).mockResolvedValue({ id: 'play-123' } as any);
    vi.mocked(notionService.createPlayerScore).mockRejectedValue(new Error('API Failure'));

    const req = new NextRequest('http://localhost/api/plays', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const response = await POST(req);
    expect(response.status).toBe(500);
    expect(notionService.deletePlaySession).toHaveBeenCalledWith('play-123');
  });
});
