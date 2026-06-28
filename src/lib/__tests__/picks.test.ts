import { describe, expect, it } from 'vitest';
import type { BoardGameNewsData } from '@/lib/boardgamenews';
import { extractGamesFromPayload, getVisiblePlayerCountSections, normalizeCloudGamesToPlayerSections } from '@/lib/picks';

describe('getVisiblePlayerCountSections', () => {
  const data: BoardGameNewsData = {
    '2': [{ bgg_id: '1', name: 'Game 2', year: 2020, image: '', thumbnail: '', min_players: 2, max_players: 4, play_time: 30, min_age: 8, weight: 2.5, rating: 7.5, users_rated: 100, bgg_rank: 1, categories: [], mechanics: [], designers: [], best_players_summary: [2], best_for: [2] }],
    '3': [{ bgg_id: '2', name: 'Game 3', year: 2021, image: '', thumbnail: '', min_players: 3, max_players: 6, play_time: 45, min_age: 10, weight: 3, rating: 8, users_rated: 200, bgg_rank: 2, categories: [], mechanics: [], designers: [], best_players_summary: [3], best_for: [3] }],
    '4': [],
  };

  it('returns all available sections when no filter is selected', () => {
    const sections = getVisiblePlayerCountSections(data, null);

    expect(sections.map((section) => section.count)).toEqual([2, 3, 4, 5, 6]);
  });

  it('keeps all 2–6 sections visible even when some have no games', () => {
    const sections = getVisiblePlayerCountSections(data, null);

    expect(sections).toHaveLength(5);
    expect(sections[2]).toMatchObject({ count: 4, games: [] });
    expect(sections[3]).toMatchObject({ count: 5, games: [] });
    expect(sections[4]).toMatchObject({ count: 6, games: [] });
  });

  it('returns only the selected section when a specific player count is chosen', () => {
    const sections = getVisiblePlayerCountSections(data, 3);

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ count: 3, games: [{ bgg_id: '2' }] });
  });

  it('normalizes cloud game data into best-player sections', () => {
    const sections = normalizeCloudGamesToPlayerSections([
      {
        name: 'Cloud Game',
        year: 2024,
        image: 'https://example.com/cover.jpg',
        minPlayers: 2,
        maxPlayers: 5,
        bestPlayers: '2,3',
      },
    ]);

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      count: 2,
      games: [{ name: 'Cloud Game', best_for: [2] }],
    });
    expect(sections[1]).toMatchObject({
      count: 3,
      games: [{ name: 'Cloud Game', best_for: [3] }],
    });
  });

  it('extracts games from player-count keyed payloads and uses summary counts', () => {
    const payload = {
      6: [{
        name: 'Summary Game',
        year: 2024,
        image: 'https://example.com/cover.jpg',
        minPlayers: 3,
        maxPlayers: 6,
        best_for: [6],
        best_players_summary: [4, 5, 6],
      }],
    };

    const games = extractGamesFromPayload(payload);
    const sections = normalizeCloudGamesToPlayerSections(games);

    expect(games).toHaveLength(1);
    expect(sections.map((section) => section.count)).toEqual([4, 5, 6]);
    expect(sections[0]).toMatchObject({ count: 4, games: [{ name: 'Summary Game', best_for: [4] }] });
  });

  it('maps metadata fields from the cloud payload into each game card', () => {
    const sections = normalizeCloudGamesToPlayerSections([
      {
        bgg_id: 12345,
        name: 'Metadata Game',
        year: 2024,
        image: 'https://example.com/cover.jpg',
        thumbnail: 'https://example.com/thumb.jpg',
        min_players: 2,
        max_players: 5,
        play_time: 45,
        min_age: 10,
        weight: 3.2,
        rating: 8.5,
        users_rated: 1200,
        bgg_rank: 12,
        categories: ['Strategy'],
        mechanics: ['Drafting'],
        designers: ['Alice'],
        best_for: [2],
      },
    ]);

    expect(sections[0]).toMatchObject({
      count: 2,
      games: [{
        bgg_id: '12345',
        name: 'Metadata Game',
        year: 2024,
        image: 'https://example.com/cover.jpg',
        thumbnail: 'https://example.com/thumb.jpg',
        min_players: 2,
        max_players: 5,
        play_time: 45,
        min_age: 10,
        weight: 3.2,
        rating: 8.5,
        users_rated: 1200,
        bgg_rank: 12,
        categories: ['Strategy'],
        mechanics: ['Drafting'],
        designers: ['Alice'],
      }],
    });
  });
});
