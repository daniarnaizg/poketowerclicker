/**
 * PokéBastion — in-arena HUD: floor, boss timer, bastion HP and ultimate charge.
 */

import { BOSS_TIMER_DURATION } from '../../config/balance.config';
import type { GameState } from '../../core/types';

interface Props {
  gameState: GameState;
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function GameHUD({ gameState }: Props) {
  const hpRatio =
    gameState.bastionMaxHp > 0
      ? Math.max(0, Math.min(1, gameState.bastionHp / gameState.bastionMaxHp))
      : 0;
  const ultRatio =
    gameState.ultimateMax > 0
      ? Math.max(0, Math.min(1, gameState.ultimateCharge / gameState.ultimateMax))
      : 0;

  return (
    <div class="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-1 p-2 text-white">
      <div class="flex items-center justify-between gap-2">
        <span class="rounded bg-slate-900/70 px-3 py-1 text-sm font-bold">Piso {gameState.floor}</span>
        <span class="rounded bg-slate-900/70 px-3 py-1 text-xs">
          Enemigos: {gameState.waveEnemiesRemaining}
        </span>
        {gameState.bossTimerSec !== undefined && (
          <span class="rounded bg-red-900/80 px-3 py-1 text-sm font-bold text-red-100">
            ⏱ {formatClock(gameState.bossTimerSec)} / {BOSS_TIMER_DURATION}s
          </span>
        )}
      </div>

      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-slate-200">BASTIÓN</span>
        <span class="h-3 flex-1 overflow-hidden rounded-full bg-slate-900/70">
          <span class="block h-full bg-emerald-500" style={{ width: `${hpRatio * 100}%` }} />
        </span>
        <span class="text-xs tabular-nums">
          {Math.ceil(gameState.bastionHp)} / {gameState.bastionMaxHp}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-slate-200">ULT</span>
        <span class="h-2 flex-1 overflow-hidden rounded-full bg-slate-900/70">
          <span class="block h-full bg-sky-400" style={{ width: `${ultRatio * 100}%` }} />
        </span>
        <span class="rounded bg-slate-900/70 px-2 py-0.5 text-xs">Espacio</span>
      </div>
    </div>
  );
}
