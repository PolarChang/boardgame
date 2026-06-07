"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Player, PlayRecord } from "@/lib/types";

interface PlayRecordModalProps {
  open: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
  gameEnglishName?: string;
  gameImage?: string;
  comment?: string;
  isAdmin?: boolean;
  adminPassword?: string;
  viewerId?: string | null;
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function PlayRecordModal({
  open,
  onClose,
  gameId,
  gameName,
  gameEnglishName,
  gameImage,
  comment,
  isAdmin = false,
  adminPassword,
  viewerId,
}: PlayRecordModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [plays, setPlays] = useState<PlayRecord[]>([]);
  const [playsLoading, setPlaysLoading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  
  // New State
  const [isCoop, setIsCoop] = useState(false);
  const [coopResult, setCoopResult] = useState<'Win' | 'Lose'>('Win');
  const [coopScore, setCoopScore] = useState('');
  const [playerScores, setPlayerScores] = useState<Record<string, { role: string, score: string, details: string }>>({});
  
  const [date, setDate] = useState(todayISODate());
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const effectivePassword = adminPassword ?? password;
  const [submitting, setSubmitting] = useState(false);

  const filteredPlays = useMemo(() => {
    if (!viewerId) return plays;
    return plays.filter(p => p.players.some(pl => pl.id === viewerId));
  }, [plays, viewerId]);

  const refreshPlays = useCallback(async () => {
    setPlaysLoading(true);
    try {
      const res = await fetch(`/api/plays?gameId=${encodeURIComponent(gameId)}`);
      const data = (await res.json()) as PlayRecord[];
      setPlays(data);
    } finally {
      setPlaysLoading(false);
    }
  }, [gameId]);

  useEffect(() => { if(open) refreshPlays(); }, [open, refreshPlays]);

  const parseScore = (text: string) => {
    const lines = text.split('\n');
    const playerScoresMap: Record<string, number> = {};
    lines.forEach(line => {
      const match = line.match(/[:：]\s*(\d+)/);
      if(match) {
        // Simple extraction for winner highlighting
        const score = parseInt(match[1]);
        playerScoresMap[line] = score;
      }
    });
    return playerScoresMap;
  };

  const getWinnerInfo = (play: PlayRecord) => {
      const parsed = parseScore(play.scores);
      const entries = Object.entries(parsed);
      if(entries.length === 0) return null;
      let maxScore = -1;
      let winner = "";
      entries.forEach(([name, score]) => {
          if(score > maxScore) { maxScore = score; winner = name; }
      });
      return { winner, maxScore };
  };

  const hallOfFame = useMemo(() => {
      let max = -1;
      let record: PlayRecord | null = null;
      plays.forEach(p => {
          const info = getWinnerInfo(p);
          if(info && info.maxScore > max) { max = info.maxScore; record = p; }
      });
      return record ? { record, max } : null;
  }, [plays]);

  const submitPlay = async () => {
      let scoreStr = "";
      if(isCoop) {
          scoreStr = `[合作] 結果: ${coopResult === 'Win' ? '勝利 🎉' : '失敗 💀'}, 團隊分數: ${coopScore}`;
      } else {
          scoreStr = Object.entries(playerScores).map(([id, data]) => {
              const p = players.find(x => x.id === id);
              return `[${data.role || '無'}] ${p?.name}: ${data.score}分 (${data.details || '無'})`;
          }).join(', ');
      }
      
      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, date, playerIds: selectedPlayerIds, scores: scoreStr, password: effectivePassword }),
      });
      if(res.ok) { await refreshPlays(); setPlayerScores({}); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row bg-white rounded-3xl overflow-hidden shadow-2xl">
        <section className="md:w-1/3 p-6 bg-gray-50 flex flex-col">
          <div className="relative w-3/4 mx-auto mb-6">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-gray-100">
              {gameImage && (
                <Image 
                  src={gameImage} 
                  alt={gameName} 
                  fill 
                  className="object-contain" 
                  sizes="300px"
                />
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed text-center">{comment || "暫無介紹"}</p>
        </section>

        <section className="md:w-2/3 p-6 flex flex-col overflow-hidden">
          <h3 className="font-bold text-lg mb-4">👑 歷史最高分: {hallOfFame?.max ?? '無'}</h3>
          <div className="flex-1 overflow-auto pr-2 space-y-3">
              {filteredPlays.map(play => {
                  const winner = getWinnerInfo(play);
                  return (
                    <article key={play.id} className="border p-3 rounded-lg whitespace-nowrap overflow-x-auto">
                        <span className="font-mono text-xs">{play.date}</span>
                        <div className="text-sm font-bold mt-1">
                            {play.scores.split(',').map((s, i) => (
                                <span key={i} className={winner?.winner.includes(s.split(':')[0]) ? "text-yellow-600" : ""}>
                                    {s}{winner?.winner.includes(s.split(':')[0]) ? ' 👑' : ''}
                                </span>
                            ))}
                        </div>
                    </article>
                  )
              })}
          </div>

          {isAdmin && (
              <div className="mt-4 pt-4 border-t space-y-3">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={isCoop} onChange={e => setIsCoop(e.target.checked)} /> 🤝 合作遊戲模式</label>
                  {isCoop ? (
                      <div className="flex gap-2">
                          <select onChange={e => setCoopResult(e.target.value as 'Win'|'Lose')} className="border p-1"><option value="Win">勝利</option><option value="Lose">失敗</option></select>
                          <input placeholder="分數" onChange={e => setCoopScore(e.target.value)} className="border p-1"/>
                      </div>
                  ) : (
                      selectedPlayerIds.map(id => (
                          <div key={id} className="flex gap-2 bg-gray-100 p-2 text-xs">
                              {players.find(p=>p.id===id)?.name}
                              <input placeholder="陣營" onChange={e => setPlayerScores(prev => ({...prev, [id]: {...prev[id], role: e.target.value}}))}/>
                              <input placeholder="總分" onChange={e => setPlayerScores(prev => ({...prev, [id]: {...prev[id], score: e.target.value}}))}/>
                          </div>
                      ))
                  )}
                  <button onClick={submitPlay} className="w-full bg-black text-white py-2 rounded">送出</button>
              </div>
          )}
        </section>
      </div>
    </div>
  );
}
