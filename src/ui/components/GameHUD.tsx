/**
 * PokéBastion — HUD sobre la arena: piso, cronómetro de jefe, HP del Bastión y ULT.
 */

import { BOSS_TIMER_DURATION } from '../../config/balance.config';
import type { GameState } from '../../core/types';
import { POKEDEX } from '../../data/pokemon';

interface Props {
  gameState: GameState;
  /** Fire the ultimate (also Space / right click). */
  onUltimate?: () => void;
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function GameHUD({ gameState, onUltimate }: Props) {
  const hpRatio =
    gameState.bastionMaxHp > 0
      ? Math.max(0, Math.min(1, gameState.bastionHp / gameState.bastionMaxHp))
      : 0;
  const ultRatio =
    gameState.ultimateMax > 0
      ? Math.max(0, Math.min(1, gameState.ultimateCharge / gameState.ultimateMax))
      : 0;
  const active = gameState.team.find((s) => s.isActive)?.pokemon ?? null;
  const ultName = active ? POKEDEX[active.definitionId]?.ultimate.name : undefined;
  const ultReady = gameState.ultimateMax > 0 && gameState.ultimateCharge >= gameState.ultimateMax;
  const shield = gameState.bastionShieldSec ?? 0;
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

      {shield > 0 && (
        <div class="flex items-center gap-2 text-[9px] text-[#2858a8]">
          <span class="w-14 shrink-0">ESCUDO</span>
          <span class="pk-num">{shield.toFixed(1)}s</span>
        </div>
      )}

      <button
        type="button"
        onClick={onUltimate}
        disabled={!ultReady}
        data-testid="ult-button"
        class={`pk-btn flex flex-col gap-1.5 px-2 py-2 text-left text-[9px] ${ultReady ? 'pk-btn-active' : ''}`}
        style={ultReady ? { animation: 'pk-pulse 0.8s ease-in-out infinite' } : undefined}
      >
        <span class="flex items-center justify-between gap-2">
          <span class="truncate">{ultReady ? `¡${(ultName ?? 'DEFINITIVA').toUpperCase()}!` : `DEF. ${(ultName ?? '').toUpperCase()}`}</span>
          <span class="pk-chip" style={{ background: '#585858' }}>ESPACIO</span>
        </span>
        <span class="pk-bar w-full">
          <span style={{ width: `${ultRatio * 100}%`, background: ultReady ? '#f8a030' : '#58b0f8' }} />
        </span>
      </button>
    </div>
  );
}
