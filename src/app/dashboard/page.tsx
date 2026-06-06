import { getGamePlays, getGamesFromNotion, getPlayers } from "@/lib/notion";
import type { Player } from "@/lib/types";

export const revalidate = 60;

export default async function DashboardPage() {
  const [players, plays, games] = await Promise.all([
    getPlayers(),
    getGamePlays(),
    getGamesFromNotion(),
  ]);

  const gameNameById = new Map(games.map((g) => [g.pageId, g.name]));

  const totalPlays = plays.length;
  const totalPlayers = players.length;

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

  const leaderboard = Array.from(playsByPlayer.values())
    .filter((row) => Boolean(row.player.name))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.player.name.localeCompare(b.player.name);
    });

  const maxPlayCount = Math.max(
    1,
    ...leaderboard.map((row) => row.count)
  );

  const recentPlays = plays.slice(0, 5).map((play) => {
    const gameName = gameNameById.get(play.gameId) || "Unknown Game";
    return { ...play, gameName };
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">戰績儀表板</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          從 Notion 遊玩紀錄聚合而成的總覽與排行榜
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            總覽
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                總局數
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {totalPlays}
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                玩家數
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {totalPlayers}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                玩家排行榜
              </p>
              <h2 className="mt-1 text-base font-bold">參與總局數</h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Top {Math.min(leaderboard.length, 10)}
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {leaderboard.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">
                尚無可統計的玩家資料
              </div>
            ) : (
              leaderboard.slice(0, 10).map((row, idx) => {
                const pct = Math.round((row.count / maxPlayCount) * 100);
                return (
                  <div key={row.player.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="mr-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          #{idx + 1}
                        </span>
                        <span className="truncate font-semibold">
                          {row.player.name}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {row.count} 局
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-violet-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            遊戲名人堂
          </p>
          <h2 className="mt-1 text-base font-bold">最新 5 筆戰報</h2>

          <div className="mt-4 space-y-4">
            {recentPlays.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">
                尚無遊玩紀錄
              </div>
            ) : (
              recentPlays.map((play) => (
                <article
                  key={play.id}
                  className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {play.date || "—"}
                      </p>
                      <p className="mt-1 truncate text-sm font-bold">
                        {play.gameName}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {play.players.length > 0 ? (
                          play.players.map((p) => (
                            <span
                              key={p.id}
                              className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                            >
                              {p.name}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            未填玩家
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {play.scores ? (
                    <pre className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                      {play.scores}
                    </pre>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                      —
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
