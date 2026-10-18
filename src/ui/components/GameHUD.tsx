/**
 * PokéBastion — HUD sobre la arena: piso, cronómetro de jefe, HP del Bastión y ULT.
 */

import { bossTimerForFloor, nextShopFloor } from '../../config/balance.config';
import type { GameState } from '../../core/types';
import { POKEDEX as POKEMON_REGISTRY } from '../../data/pokemon';
import { AudioToggle } from './AudioToggle';

interface Props {
  gameState: GameState;
  /** Fire the ultimate (also Space / right click). */
  onUltimate?: () => void;
  /** Flip auto-advance to the next floor after the breather. */
  onToggleAutoAdvance?: () => void;
  /** Spawn the next floor now (during the breather / manual wait). */
  onStartNextWave?: () => void;
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function GameHUD({ gameState, onUltimate, onToggleAutoAdvance, onStartNextWave }: Props) {
  const activeSlot = gameState.team.find((s) => s.isActive && s.pokemon);
  const activePkm = activeSlot?.pokemon ?? null;
  const activeDef = activePkm ? POKEMON_REGISTRY[activePkm.definitionId] : null;

  const activeHp = activePkm ? Math.max(0, Math.ceil(activePkm.hp)) : 0;
  const activeMaxHp = activePkm ? Math.max(1, activePkm.maxHp) : 1;
  const hpRatio = Math.max(0, Math.min(1, activeHp / activeMaxHp));

  const occupiedSlots = gameState.team.filter((s) => s.pokemon !== null);
  const aliveCount = occupiedSlots.filter((s) => s.pokemon?.alive).length;
  const totalCount = occupiedSlots.length;
  const sumHp = occupiedSlots.reduce((acc, s) => acc + (s.pokemon?.alive ? Math.max(0, s.pokemon.hp) : 0), 0);
  const sumMaxHp = Math.max(1, occupiedSlots.reduce((acc, s) => acc + (s.pokemon?.maxHp ?? 0), 0));
  const reservePct = Math.round((sumHp / sumMaxHp) * 100);

  const nextStop = nextShopFloor(gameState.floor);
  const floorsToStop = Math.max(0, nextStop - gameState.floor);

  const ultRatio =
    gameState.ultimateMax > 0
      ? Math.max(0, Math.min(1, gameState.ultimateCharge / gameState.ultimateMax))
      : 0;
  const ultName = activeDef ? activeDef.ultimate.name : undefined;
  const ultReady = gameState.ultimateMax > 0 && gameState.ultimateCharge >= gameState.ultimateMax;
  const shield = gameState.bastionShieldSec ?? 0;
  const hpColor = hpRatio > 0.5 ? '#48c048' : hpRatio >= 0.25 ? '#f8d030' : '#f04040';
  // Undefined autoAdvanceWave means ON (headless sims and old states keep auto-advancing).
  const auto = gameState.autoAdvanceWave !== false;
  const inBreak = !!gameState.awaitingNextWave || gameState.interWaveTimerSec !== undefined;
  const ultRemainingSec = Math.ceil(gameState.ultimateMax - gameState.ultimateCharge);

  const boss = gameState.enemies.find((e) => e.alive && e.isBoss);
  const bossHp = boss ? Math.max(0, Math.ceil(boss.hp)) : 0;
  const bossMaxHp = boss ? Math.max(1, boss.maxHp) : 1;
  const bossHpRatio = Math.max(0, Math.min(1, bossHp / bossMaxHp));
  const bossHpColor = bossHpRatio > 0.5 ? '#48c048' : bossHpRatio >= 0.25 ? '#f8d030' : '#f04040';

  return (
    <div class="game-hud pk-window flex shrink-0 flex-col gap-2.5 p-3">
      <div class="flex items-center justify-between gap-2 text-[10px]">
        <span class="pk-dark px-2 py-2">PISO {gameState.floor}</span>
        <span
          className="pk-chip bg-[#142038] text-[#78f0a0] border border-[#2a4268] text-[9px]"
          title={`Próxima Parada de Ruta antes del piso ${nextStop} (cada 10 pisos desde el 5)`}
        >
          PARADA P.{nextStop} ({floorsToStop === 0 ? 'AHORA' : `${floorsToStop}P`})
        </span>
        <span class="pk-dark px-2 py-2">SALVAJES {gameState.waveEnemiesRemaining}</span>
        {gameState.bossTimerSec !== undefined && (
          <span class="pk-dark px-2 py-2 text-[#f85848]">
            {formatClock(gameState.bossTimerSec)}/{bossTimerForFloor(gameState.floor)}s
          </span>
        )}
      </div>

      <div class="flex items-center gap-2 text-[9px]">
        <button
          type="button"
          onClick={onToggleAutoAdvance}
          class={`pk-chip cursor-pointer ${auto ? '' : 'opacity-60'}`}
          style={{ background: auto ? '#48c048' : '#585858' }}
        >
          AUTO {auto ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          onClick={onStartNextWave}
          disabled={!inBreak}
          class="pk-btn flex-1 px-2 py-1 text-[9px]"
          data-testid="next-wave-button"
        >
          {inBreak
            ? gameState.interWaveTimerSec !== undefined
              ? `SIGUIENTE PISO (${Math.ceil(gameState.interWaveTimerSec)}s)`
              : 'SIGUIENTE PISO'
            : `PISO ${gameState.floor}`}
        </button>
        <AudioToggle />
      </div>

      {boss && (
        <div class="flex items-center gap-2 text-[9px]">
          <span class="pk-chip shrink-0" style={{ background: '#7c3aed' }}>
            FASE {boss.bossPhase ?? 1}/3
          </span>
          {(boss.bossInvulnSec ?? 0) > 0 && (
            <span class="pk-chip shrink-0 font-bold" style={{ background: '#c084fc', color: '#1a1a1a' }}>
              INVULN
            </span>
          )}
          {boss.enraged && (
            <span class="pk-chip shrink-0 font-bold text-white" style={{ background: '#f04040' }}>
              ¡ENFURECIDO!
            </span>
          )}
          <span class="pk-bar relative flex-1">
            <span style={{ width: `${bossHpRatio * 100}%`, background: bossHpColor }} />
            <span
              class="absolute top-0 bottom-0 w-[2px] bg-[#303030] pointer-events-none z-10"
              style={{ left: '33%' }}
            />
            <span
              class="absolute top-0 bottom-0 w-[2px] bg-[#303030] pointer-events-none z-10"
              style={{ left: '66%' }}
            />
          </span>
          <span class="pk-num">
            {bossHp}/{bossMaxHp}
          </span>
        </div>
      )}

      <div class="flex items-center gap-2 text-[9px]">
        <span class="w-14 shrink-0 truncate">{activeDef ? activeDef.name.toUpperCase() : 'ACTIVO'}</span>
        <span class="pk-bar flex-1">
          <span style={{ width: `${hpRatio * 100}%`, background: hpColor }} />
        </span>
        <span class="pk-num">
          {activeHp}/{activeMaxHp}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-[#a8c0e0] px-0.5">
        <span>RESERVA EQUIPO: <b className="text-white">{reservePct}%</b></span>
        <span className={aliveCount <= 1 ? 'text-[#f85888] font-bold' : 'text-[#78f0a0]'}>
          {aliveCount}/{totalCount} VIVOS
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
          <span class="truncate">
            {ultReady
              ? `¡${(ultName ?? 'DEFINITIVA').toUpperCase()}!`
              : `DEF. ${(ultName ?? '').toUpperCase()} · ${ultRemainingSec}s`}
          </span>
          <span class="pk-chip" style={{ background: '#585858' }}>ESPACIO</span>
        </span>
        <span class="pk-bar w-full">
          <span style={{ width: `${ultRatio * 100}%`, background: ultReady ? '#f8a030' : '#58b0f8' }} />
        </span>
      </button>
    </div>
  );
}
