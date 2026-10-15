/**
 * PokéBastion — HUD sobre la arena: piso, cronómetro de jefe, HP del Bastión y ULT.
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
  const hpColor = hpRatio > 0.5 ? '#48c048' : hpRatio >= 0.25 ? '#f8d030' : '#f04040';

  return (
    <div class="pk-window flex shrink-0 flex-col gap-2.5 p-3">
      <div class="flex items-center justify-between gap-2 text-[10px]">
        <span class="pk-dark px-2 py-2">PISO {gameState.floor}</span>
        <span class="pk-dark px-2 py-2">SALVAJES {gameState.waveEnemiesRemaining}</span>
        {gameState.bossTimerSec !== undefined && (
          <span class="pk-dark px-2 py-2 text-[#f85848]">
            {formatClock(gameState.bossTimerSec)}/{BOSS_TIMER_DURATION}s
          </span>
        )}
      </div>

      <div class="flex items-center gap-2 text-[9px]">
        <span class="w-14 shrink-0">BASTION</span>
        <span class="pk-bar flex-1">
          <span style={{ width: `${hpRatio * 100}%`, background: hpColor }} />
        </span>
        <span class="pk-num">
          {Math.ceil(gameState.bastionHp)}/{gameState.bastionMaxHp}
        </span>
      </div>

      <div class="flex items-center gap-2 text-[9px]">
        <span class="w-14 shrink-0">ULT</span>
        <span class="pk-bar flex-1">
          <span style={{ width: `${ultRatio * 100}%`, background: '#58b0f8' }} />
        </span>
        <span class="pk-chip" style={{ background: '#585858' }}>ESPACIO</span>
      </div>
    </div>
  );
}
