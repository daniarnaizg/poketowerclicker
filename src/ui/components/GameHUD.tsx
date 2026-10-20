/**
 * PokéBastion — panel de controles: estado del piso, siguiente piso, velocidad, AUTO y audio.
 * Lo relativo a los Pokémon (vida, definitiva, equipo, estadísticas) vive en `PokemonPanel`.
 * Todo el maquetado vive en `ui/gameUi.css` (unidades em, tamaños fijos por fila): ningún
 * texto cambia el tamaño de un botón y el panel escala con la pantalla.
 */

import { bossTimerForFloor, nextShopFloor } from '../../config/balance.config';
import type { GameState } from '../../core/types';
import { AudioToggle } from './AudioToggle';

interface Props {
  gameState: GameState;
  /** Simulation speed multiplier (1x / 2x / 4x); hidden when omitted. */
  speed?: number;
  onSetSpeed?: (speed: 1 | 2 | 4) => void;
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

/** Doble flecha pixel-art: identifica el selector 1x/2x/4x como velocidad de juego. */
function SpeedIcon() {
  return (
    <svg viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">
      <path d="M1 1h1v1h1v1h1v1h1v2H4v1H3v1H2v1H1V1zM5 1h1v1h1v1h1v1h1v2H8v1H7v1H6v1H5V1z" fill="#f8f8f0" />
    </svg>
  );
}

export function GameHUD({ gameState, speed, onSetSpeed, onToggleAutoAdvance, onStartNextWave }: Props) {
  const nextStop = nextShopFloor(gameState.floor);
  const floorsToStop = Math.max(0, nextStop - gameState.floor);
  // Undefined autoAdvanceWave means ON (headless sims and old states keep auto-advancing).
  const auto = gameState.autoAdvanceWave !== false;
  const inBreak = !!gameState.awaitingNextWave || gameState.interWaveTimerSec !== undefined;

  const boss = gameState.enemies.find((e) => e.alive && e.isBoss);
  const bossHp = boss ? Math.max(0, Math.ceil(boss.hp)) : 0;
  const bossMaxHp = boss ? Math.max(1, boss.maxHp) : 1;
  const bossHpRatio = Math.max(0, Math.min(1, bossHp / bossMaxHp));
  const bossHpColor = bossHpRatio > 0.5 ? '#48c048' : bossHpRatio >= 0.25 ? '#f8d030' : '#f04040';
  const bossStatus =
    boss && (boss.bossInvulnSec ?? 0) > 0 ? 'INVULN' : boss?.enraged ? '¡ENFURECIDO!' : '';

  return (
    <div class="gx-win gx-ctl">
      <div class="gx-ctl-top">
        <div class="gx-stats">
          <div class="gx-stat">
            <span class="gx-stat-l">PISO</span>
            <span class="gx-stat-v">{gameState.floor}</span>
          </div>
          <div class="gx-stat">
            <span class="gx-stat-l">SALVAJES</span>
            <span class="gx-stat-v">{gameState.waveEnemiesRemaining}</span>
          </div>
          {gameState.bossTimerSec !== undefined ? (
            <div class="gx-stat gx-stat-boss" title="Tiempo restante para derrotar al jefe">
              <span class="gx-stat-l">JEFE · {bossTimerForFloor(gameState.floor)}s</span>
              <span class="gx-stat-v">{formatClock(gameState.bossTimerSec)}</span>
            </div>
          ) : (
            <div
              class="gx-stat gx-stat-stop"
              title={`Próxima Parada de Ruta antes del piso ${nextStop} (cada 10 pisos desde el 5)`}
            >
              <span class="gx-stat-l">PARADA P.{nextStop}</span>
              <span class="gx-stat-v">{floorsToStop === 0 ? 'AHORA' : `EN ${floorsToStop}P`}</span>
            </div>
          )}
        </div>

        {/* Una sola ranura: el jefe (fase + vida) tapa el botón mientras vive; el botón
            sigue montado y deshabilitado debajo (no hay respiro con un jefe vivo). */}
        <div class="gx-next-slot">
          <button
            type="button"
            onClick={onStartNextWave}
            disabled={!inBreak}
            class="gx-btn gx-next"
            data-testid="next-wave-button"
          >
            <span class="gx-next-t">SIGUIENTE PISO</span>
            <span class="gx-next-cd">
              {inBreak && gameState.interWaveTimerSec !== undefined
                ? `${Math.ceil(gameState.interWaveTimerSec)}s`
                : ''}
            </span>
          </button>
          {boss && (
            <div class="gx-boss-over">
              <span class="pk-chip shrink-0" style={{ background: '#7c3aed' }}>
                FASE {boss.bossPhase ?? 1}/3
              </span>
              <span class="gx-boss-bar gx-bar-wrap" style={{ flex: '1 1 0', minWidth: 0 }}>
                <span class="gx-bar">
                  <span style={{ width: `${bossHpRatio * 100}%`, background: bossHpColor }} />
                  <span class="gx-boss-mark" style={{ left: '33%' }} />
                  <span class="gx-boss-mark" style={{ left: '66%' }} />
                </span>
                {bossStatus && <span class="gx-boss-tag">{bossStatus}</span>}
              </span>
              <span class="gx-num gx-boss-hp">
                {bossHp}/{bossMaxHp}
              </span>
            </div>
          )}
        </div>
      </div>

      <div class="gx-ctl-bottom">
        {speed !== undefined && onSetSpeed && (
          <div class="gx-speedgrp">
            <span class="gx-speed-ico" role="img" aria-label="Velocidad de juego" title="Velocidad de juego">
              <SpeedIcon />
            </span>
            <div class="gx-speed">
              {([1, 2, 4] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSetSpeed(s)}
                  class={`gx-btn gx-tog ${speed === s ? 'is-speed' : 'is-off'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleAutoAdvance}
          class={`gx-btn gx-tog gx-auto ${auto ? 'is-on' : 'is-off'}`}
        >
          AUTO {auto ? 'ON' : 'OFF'}
        </button>
        <AudioToggle />
      </div>
    </div>
  );
}
