import type { NotionGame } from "@/lib/types";

interface GameCardProps {
  game: NotionGame;
}

export default function GameCard({ game }: GameCardProps) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative bg-gray-100">
        {game.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.image}
            alt={game.name}
            className="h-48 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-xs text-gray-400">
            No cover image
          </div>
        )}
        <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow">
          {game.complexity.toFixed(1)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-sm font-bold leading-snug text-gray-900">{game.name}</h2>

        <div className="mt-auto flex flex-wrap gap-2">
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
            Best {game.bestPlayers || "—"} players
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {game.minPlayers}–{game.maxPlayers} players
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {game.playTime} min
          </span>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">
            Rating {game.rating.toFixed(1)}
          </span>
        </div>
      </div>
    </article>
  );
}
