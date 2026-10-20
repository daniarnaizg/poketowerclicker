/**
 * PokéBastion — sección «Pokémon» del panel: activo (vida, reserva, definitiva),
 * equipo (6 tarjetas) y estadísticas del activo según el nivel de equipo.
 * Estilos en `ui/gameUi.css` (clases `gx-pkm*`, `gx-sub`, `gx-sl`).
 */

import type { GameState } from '../../core/types';
import { POKEDEX as POKEMON_REGISTRY } from '../../data/pokemon';
import { getStatMultiplier } from '../../core/teamLevel';
import { TeamBar } from './TeamBar';

interface Props {
  gameState: GameState;
  /** Fire the ultimate (also Space / right click). */
  onUltimate?: () => void;
  onHotSwap: (index: number) => void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function PokemonPanel({ gameState, onUltimate, onHotSwap }: Props) {
  const activeSlot = gameState.team.find((s) => s.isActive && s.pokemon);
  const activePkm = activeSlot?.pokemon ?? null;
  const activeDef = activePkm ? POKEMON_REGISTRY[activePkm.definitionId] : null;

  const activeHp = activePkm ? Math.max(0, Math.ceil(activePkm.hp)) : 0;
  const activeMaxHp = activePkm ? Math.max(1, activePkm.maxHp) : 1;
  const hpRatio = Math.max(0, Math.min(1, activeHp / activeMaxHp));
  const hpColor = hpRatio > 0.5 ? '#48c048' : hpRatio >= 0.25 ? '#f8d030' : '#f04040';

  const occupiedSlots = gameState.team.filter((s) => s.pokemon !== null);
  const aliveCount = occupiedSlots.filter((s) => s.pokemon?.alive).length;
  const totalCount = occupiedSlots.length;
  const sumHp = occupiedSlots.reduce((acc, s) => acc + (s.pokemon?.alive ? Math.max(0, s.pokemon.hp) : 0), 0);
  const sumMaxHp = Math.max(1, occupiedSlots.reduce((acc, s) => acc + (s.pokemon?.maxHp ?? 0), 0));
  const reservePct = Math.round((sumHp / sumMaxHp) * 100);
  const shield = gameState.bastionShieldSec ?? 0;

  const ultRatio =
    gameState.ultimateMax > 0
      ? Math.max(0, Math.min(1, gameState.ultimateCharge / gameState.ultimateMax))
      : 0;
  const ultName = activeDef ? activeDef.ultimate.name : undefined;
  const ultReady = gameState.ultimateMax > 0 && gameState.ultimateCharge >= gameState.ultimateMax;
  const ultRemainingSec = Math.ceil(gameState.ultimateMax - gameState.ultimateCharge);

  // Estadísticas internas del activo: base de la especie escalada por el nivel de equipo
  // (ataque y PS); no incluyen las mejoras del bastión, que se ven en MEJORAS.
  const stats: Array<[string, string]> = activePkm
    ? [
        ['PS MÁX.', `${Math.round(activePkm.maxHp)}`],
        ['ATAQUE', `${Math.round(activePkm.atk * getStatMultiplier(gameState.teamLevel))}`],
        ['CADENCIA', `${activePkm.spd.toFixed(1)}/s`],
        ['CRÍTICO', pct(activePkm.critRate)],
        ['DAÑO CRÍT.', `${activePkm.critDmg.toFixed(1)}x`],
        ['DEFINITIVA', `${Math.round(activePkm.ultimateMax)}s`],
      ]
    : ['PS MÁX.', 'ATAQUE', 'CADENCIA', 'CRÍTICO', 'DAÑO CRÍT.', 'DEFINITIVA'].map((l): [string, string] => [l, '—']);

  return (
    <div class="gx-win gx-pkm">
      <section class="gx-sub gx-active">
        <div class="gx-sl">
          <span>ACTIVO</span>
          <span class="gx-reserve">
            <span>
              RESERVA <b>{reservePct}%</b>
            </span>
            <span class="gx-shield">{shield > 0 ? `ESCUDO ${shield.toFixed(1)}s` : ''}</span>
            <span
              class={`gx-pips ${aliveCount <= 1 ? 'is-low' : 'is-ok'}`}
              role="img"
              aria-label={`${aliveCount}/${totalCount} vivos`}
              title={`${aliveCount}/${totalCount} vivos`}
            >
              {gameState.team.map((s, i) => (
                <i key={i} class={s.pokemon?.alive ? 'is-alive' : s.pokemon ? 'is-down' : 'is-empty'} />
              ))}
            </span>
          </span>
        </div>
        <div class="gx-active-hp">
          <span class="gx-active-name">{activeDef ? activeDef.name.toUpperCase() : 'ACTIVO'}</span>
          <span class="gx-num gx-hp">
            {activeHp}/{activeMaxHp}
          </span>
        </div>
        <span class="gx-bar gx-active-bar">
          <span style={{ width: `${hpRatio * 100}%`, background: hpColor }} />
        </span>
        <button
          type="button"
          onClick={onUltimate}
          disabled={!ultReady}
          data-testid="ult-button"
          class={`gx-btn gx-ult ${ultReady ? 'is-hot is-ready' : ''}`}
        >
          <span class="gx-ult-name">
            {ultReady ? `¡${(ultName ?? 'DEFINITIVA').toUpperCase()}!` : `DEF. ${(ultName ?? '').toUpperCase()}`}
          </span>
          <span class="gx-bar">
            <span style={{ width: `${ultRatio * 100}%`, background: ultReady ? '#f8a030' : '#58b0f8' }} />
          </span>
          <span class="gx-num gx-ult-cd">{ultReady ? '' : `${ultRemainingSec}s`}</span>
          <span class="gx-key">ESPACIO</span>
        </button>
      </section>

      <TeamBar
        team={gameState.team}
        hotSwapCooldowns={gameState.hotSwapCooldowns}
        teamLevel={gameState.teamLevel}
        onHotSwap={onHotSwap}
      />

      <section class="gx-sub gx-stats-sec">
        <div class="gx-sl">
          <span>ESTADÍSTICAS{activeDef ? ` · ${activeDef.name.toUpperCase()}` : ''}</span>
          <span>Nv {gameState.teamLevel}</span>
        </div>
        <div class="gx-pstats">
          {stats.map(([label, value]) => (
            <div key={label} class="gx-pstat">
              <span class="gx-pstat-l">{label}</span>
              <span class="gx-num gx-pstat-v">{value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
