import { Suspense } from 'react';
import Link from 'next/link';
import {
  BOARDGAME_NEWS_URL,
  type BoardGameNewsData,
  type BoardGameNewsEntry,
} from '@/lib/boardgamenews';
import { extractGamesFromPayload, getVisiblePlayerCountSections, normalizeCloudGamesToPlayerSections } from '@/lib/picks';

const DEFAULT_ALL_GAMES_URL = 'https://drive.google.com/uc?export=download&id=1iDZSWtUakQ9gOkpYnQcWxoJ2lS9aLaFT';

async function getPicks(): Promise<BoardGameNewsData> {
  const cloudUrl = process.env.ALL_GAMES_JSON_URL ?? DEFAULT_ALL_GAMES_URL;

  if (cloudUrl) {
    try {
      const cloudRes = await fetch(cloudUrl, {
        next: { revalidate: 3600 },
      });

      if (cloudRes.ok) {
        const payload = await cloudRes.json();
        const sections = normalizeCloudGamesToPlayerSections(extractGamesFromPayload(payload));

        return Object.fromEntries(
          sections.map((section) => [String(section.count), section.games]),
        ) as BoardGameNewsData;
      }
    } catch (error) {
      console.error('Failed to load cloud all_games.json for picks:', error);
    }
  }

  const res = await fetch(BOARDGAME_NEWS_URL, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error('無法載入 BoardGameNews 精選推薦');
  }

  return res.json();
}

function formatBestPlayers(entry: BoardGameNewsEntry): string {
  const nums = entry.best_for
    .map((n) => String(n))
    .filter((n) => ['2', '3', '4', '5', '6'].includes(n));

  if (nums.length === 0) {
    const unique = Array.from(new Set(entry.best_players_summary)).sort((a, b) => a - b);
    if (unique.length > 0) {
      return `${unique[0]}–${unique[unique.length - 1]}人`;
    }
    return `${entry.min_players}–${entry.max_players}人`;
  }

  if (nums.length === 1) return `${nums[0]}人`;
  return `${nums[0]}–${nums[nums.length - 1]}人`;
}

function PlayerCountSection({
  count,
  games,
}: {
  count: number;
  games: BoardGameNewsEntry[];
}) {
  return (
    <section className='mb-12'>
      <div className='mb-4 flex items-center gap-3'>
        <h2 className='font-heading text-xl font-bold tracking-wide text-ink'>
          {count} 人遊戲
        </h2>
        <span className='rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 text-xs font-semibold text-brass'>
          BEST {count}
        </span>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {games.map((game) => {
          const primaryName = game.name;
          return (
            <article
              key={`${count}-${game.bgg_id}`}
              className='card-euro rounded-sm overflow-hidden'
            >
              <div className='relative h-44 bg-parchment-dark'>
                {game.image ? (
                  <img
                    src={game.image}
                    alt={primaryName}
                    className='h-full w-full object-contain p-3'
                  />
                ) : (
                  <div className='flex h-full items-center justify-center text-xs text-ink-muted'>
                    No cover image
                  </div>
                )}

                <div className='absolute left-2 top-2 rounded-full bg-ink/60 px-2 py-1'>
                  <span className='text-[10px] font-bold text-brass'>
                    #{game.bgg_rank}
                  </span>
                </div>

                <div className='absolute right-2 top-2 rounded-full bg-ink/60 px-2 py-1'>
                  <span className='text-[10px] font-bold text-brass'>
                    ★{game.weight.toFixed(1)}
                  </span>
                </div>
              </div>

              <div className='flex flex-col gap-2 p-4'>
                <div>
                  <h3 className='truncate text-sm font-bold text-ink'>{primaryName}</h3>
                  <p className='mt-0.5 text-[11px] text-ink-light'>{game.year}</p>
                </div>

                <div className='flex flex-wrap items-center gap-1.5'>
                  <span className='rounded-full border border-grid-line bg-parchment px-2 py-0.5 text-[10px] font-medium text-ink-light'>
                    {game.min_players}–{game.max_players}人
                  </span>
                  <span className='rounded-full border border-brass/30 bg-brass/10 px-2 py-0.5 text-[10px] font-semibold text-brass'>
                    {formatBestPlayers(game)}
                  </span>
                  <span className='rounded-full border border-grid-line bg-parchment px-2 py-0.5 text-[10px] font-medium text-ink-light'>
                    {game.play_time}分
                  </span>
                </div>

                <div className='flex items-center justify-between pt-1 text-[11px] text-ink-light'>
                  <span>BGG {game.rating.toFixed(2)}</span>
                  <span>{game.users_rated.toLocaleString()} 人評價</span>
                </div>

                <div className='flex flex-wrap gap-1 pt-1'>
                  {game.categories.slice(0, 3).map((category) => (
                    <span
                      key={category}
                      className='rounded-full border border-grid-line bg-parchment-light px-2 py-0.5 text-[10px] text-ink-light'
                    >
                      {category}
                    </span>
                  ))}
                </div>

                <Link
                  href={`https://boardgamegeek.com/boardgame/${game.bgg_id}`}
                  target='_blank'
                  rel='noreferrer'
                  className='btn-euro mt-1 rounded-sm text-center text-xs'
                >
                  在 BGG 查看
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Skeleton() {
  return (
    <div className='mx-auto max-w-7xl px-6 py-10 sm:px-8'>
      {[2, 3, 4, 5, 6].map((count) => (
        <section key={count} className='mb-12'>
          <div className='mb-4 h-6 w-24 animate-pulse rounded bg-euro-border/40' />
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className='card-euro rounded-sm overflow-hidden'
              >
                <div className='h-44 animate-pulse bg-parchment-dark' />
                <div className='space-y-2 p-4'>
                  <div className='h-4 w-3/4 animate-pulse rounded bg-euro-border/40' />
                  <div className='h-3 w-1/4 animate-pulse rounded bg-euro-border/30' />
                  <div className='flex gap-2'>
                    <div className='h-5 w-16 animate-pulse rounded-full bg-euro-border/30' />
                    <div className='h-5 w-16 animate-pulse rounded-full bg-euro-border/30' />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function parseSelectedCount(
  searchParams?: Record<string, string | string[] | undefined>,
): number | null {
  const rawValue = searchParams?.count;
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return [2, 3, 4, 5, 6].includes(parsed) ? parsed : null;
}

export default async function PicksPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const resolvedSearchParams = await searchParams;
  const selectedCount = parseSelectedCount(resolvedSearchParams);

  return (
    <div className='mx-auto max-w-7xl px-6 py-10 sm:px-8'>
      <div className='mb-10'>
        <h1 className='font-heading text-3xl font-bold tracking-wide text-ink'>
          BoardGameNews 精選推薦
        </h1>
        <p className='mt-2 text-sm text-ink-light'>
          根據各玩家人數的最佳遊戲清單，這些遊戲在該人數下特別受到推薦。
        </p>
        <p className='mt-1 text-xs text-ink-muted'>
          資料來源：BoardGameNews（每週二至週六自動更新）
        </p>
      </div>

      <div className='brass-border-thin mb-6 rounded-sm bg-parchment-light p-5'>
        <div className='flex flex-col gap-3 text-sm text-ink-light sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <span className='font-semibold text-ink'>篩選邏輯：</span>
            每款遊戲會出現在符合 <span className='font-semibold text-brass'>Best For</span> 條件的玩家人數區段中。
          </div>
          <form method='get' action='/picks' className='flex flex-wrap items-center gap-2'>
            <label htmlFor='count' className='text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted'>
              最佳人數
            </label>
            <select
              id='count'
              name='count'
              defaultValue={selectedCount ?? ''}
              className='rounded-sm border border-euro-border bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brass/30'
            >
              <option value=''>全部 2–6 人</option>
              {[2, 3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count} 人
                </option>
              ))}
            </select>
            <button
              type='submit'
              className='btn-euro rounded-sm px-3 py-2 text-sm'
            >
              套用
            </button>
            {selectedCount !== null && (
              <Link href='/picks' className='text-sm font-medium text-brass hover:underline'>
                清除
              </Link>
            )}
          </form>
        </div>
      </div>

      <div className='mb-8 flex flex-wrap items-center gap-2 text-sm text-ink-light'>
        <span className='rounded-full border border-brass/30 bg-brass/10 px-2.5 py-0.5 text-brass'>
          {selectedCount === null ? '顯示全部 2–6 人推薦' : `顯示 ${selectedCount} 人推薦`}
        </span>
        <span className='text-xs text-ink-muted'>
          你可以直接選擇特定最佳人數來查看對應清單。
        </span>
      </div>

      <Suspense fallback={<Skeleton />}>
        <PicksContent selectedCount={selectedCount} />
      </Suspense>
    </div>
  );
}

async function PicksContent({ selectedCount }: { selectedCount: number | null }) {
  let data: BoardGameNewsData;
  let loadError: string | null = null;

  try {
    data = await getPicks();
  } catch (err) {
    data = {};
    loadError = err instanceof Error ? err.message : '無法載入精選推薦資料';
  }

  if (loadError) {
    return (
      <div className='rounded-sm border border-wax-red/40 bg-wax-red/5 p-6 text-sm text-ink-light'>
        <p className='font-semibold text-wax-red mb-2'>⚠️ {loadError}</p>
        <p className='text-xs text-ink-muted'>
          資料來源暫時無法存取，請稍後再試。
        </p>
      </div>
    );
  }

  const sections = getVisiblePlayerCountSections(data, selectedCount);

  if (sections.length === 0) {
    return (
      <div className='rounded-sm border border-euro-border/60 bg-parchment-light p-6 text-sm text-ink-light'>
        目前沒有符合 {selectedCount} 人的推薦遊戲。
      </div>
    );
  }

  return (
    <>
      {sections.map((section) => (
        <PlayerCountSection
          key={section.count}
          count={section.count}
          games={section.games}
        />
      ))}
    </>
  );
}
