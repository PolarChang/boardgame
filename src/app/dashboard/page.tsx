import { getGamePlays, getGamesFromNotion, getPlayers } from "@/lib/notion";
import type { Player } from "@/lib/types";

export const revalidate = 60;

function rankLabel(rank: number) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

export default async function DashboardPage() {
  const [players, plays, games] = await Promise.all([
    getPlayers(),
    getGamePlays(),
    getGamesFromNotion(),
  ]);

  const gameNameById = new Map(
    games.map((g) => [
      g.pageId,
      (g.chineseName ?? "").trim() || g.name || "Unknown Game",
    ])
  );

  const totalPlays = plays.length;
  const totalPlayers = players.length;

  const playCountByGame = new Map<string, number>();
  for (const play of plays) {
    if (!play.gameId) continue;
    playCountByGame.set(play.gameId, (playCountByGame.get(play.gameId) ?? 0) + 1);
  }
  const topGames = Array.from(playCountByGame.entries())
    .map(([gameId, count]) => ({
      gameId,
      count,
      name: gameNameById.get(gameId) || "Unknown Game",
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 3);

  const playsByPlayer = new Map<string, { player: Player; count: number }>();
  for (const p of players) {
    playsByPlayer.set(p.id, { player: p, count: 0 });
  }
  for (const play of plays) {
    for (const p of play.players) {
      const existing = playsByPlayer.get(p.id);
      if (existing) {
        existing.count += 1;
      } else {
        playsByPlayer.set(p.id, { player: p, count: 1 });
      }
    }
  }

  const playerActivity = Array.from(playsByPlayer.values())
    .filter((row) => Boolean(row.player.name))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.player.name.localeCompare(b.player.name);
    });

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">桌遊戰績儀表板</h1>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="grid grid-cols-1 gap-6 lg:col-span-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              總遊玩局數
            </p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {totalPlays}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              已記錄玩家數
            </p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
              {totalPlayers}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            最常開的遊戲
          </p>
          <h2 className="mt-1 text-base font-bold text-gray-900 dark:text-gray-50">
            Top 3
          </h2>

          <ol className="mt-4 space-y-3">
            {topGames.length === 0 ? (
              <li className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">
                尚無遊玩紀錄
              </li>
            ) : (
              topGames.map((row, idx) => (
                <li
                  key={row.gameId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950/30"
                >
                  <div className="min-w-0">
                    <span className="mr-2 inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800 dark:bg-violet-950/40 dark:text-violet-200">
                      {rankLabel(idx + 1)}
                    </span>
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {row.name}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {row.count} 局
                  </span>
                </li>
              ))
            )}
          </ol>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                玩家活躍度
              </p>
              <h2 className="mt-1 text-base font-bold text-gray-900 dark:text-gray-50">
                參與總局數排行榜
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {playerActivity.length} 位玩家
            </p>
          </div>

          <ol className="mt-4 space-y-2">
            {playerActivity.length === 0 ? (
              <li className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">
                尚無可統計的玩家資料
              </li>
            ) : (
              playerActivity.slice(0, 20).map((row, idx) => (
                <li
                  key={row.player.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950/30"
                >
                  <div className="min-w-0">
                    <span className="mr-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                      {rankLabel(idx + 1)}
                    </span>
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {row.player.name}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {row.count} 局
                  </span>
                </li>
              ))
            )}
          </ol>
        </section>
      </div>
    </main>
  );
}
