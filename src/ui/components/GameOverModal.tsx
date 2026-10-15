/**
 * PokéBastion — end-of-run summary ("Ficha de Entrenador") with rune payout.
 */

import { runePayout } from '../../config/balance.config';
import { POKEDEX } from '../../data/pokemon';
import type { RunStats, Team6 } from '../../core/types';

interface Props {
  runStats: RunStats;
  /** Final team; used to resolve the MVP slot to a Pokémon name. */
  team: Team6;
  onRestart: () => void;
}

function defeatLabel(runStats: RunStats): string {
  const reason =
    runStats.defeatCause === 'bossTimerExpired'
      ? 'Tiempo agotado'
      : runStats.defeatCause === 'bastionDestroyed'
        ? 'Bastión destruido'
        : '—';
  return runStats.defeatEnemyType ? `${reason} (${runStats.defeatEnemyType})` : reason;
}

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div class="rounded-lg bg-slate-800 p-3">
      <dt class="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd class="text-lg font-semibold">{value}</dd>
    </div>
  );
}

export function GameOverModal({ runStats, team, onRestart }: Props) {
  const runes = runePayout(runStats.floorReached);
  const mvpPokemon = runStats.mvpSlotIndex >= 0 ? team[runStats.mvpSlotIndex]?.pokemon : null;
  const mvp = mvpPokemon
    ? (POKEDEX[mvpPokemon.definitionId]?.name ?? `Slot ${runStats.mvpSlotIndex + 1}`)
    : '—';
  const cause = defeatLabel(runStats);
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div class="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-900 p-6 text-white shadow-2xl">
        <h2 class="text-center text-2xl font-bold text-amber-400">🏆 Ficha de Entrenador</h2>
        <dl class="mt-5 grid grid-cols-2 gap-3 text-sm">
          <Stat label="Piso alcanzado" value={runStats.floorReached} />
          <Stat label="Bajas" value={runStats.totalKills} />
          <Stat label="Oro ganado" value={runStats.totalGoldEarned} />
          <Stat label="Duración" value={formatDuration(runStats.durationSec)} />
          <Stat label="Causa" value={cause} />
          <div class="col-span-2">
            <Stat label="MVP" value={mvp} />
          </div>
        </dl>
        <div class="mt-4 rounded-lg bg-slate-800 p-3 text-center">
          <span class="text-xs uppercase tracking-wide text-slate-400">Runas ganadas</span>
          <div class="text-3xl font-bold text-amber-300">🔮 {runes}</div>
        </div>
        <button
          type="button"
          onClick={onRestart}
          class="mt-4 w-full rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-900 transition hover:bg-amber-400"
        >
          Nueva partida
        </button>
      </div>
    </div>
  );
}
