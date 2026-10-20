/**
 * PokéBastion — equipo de 6 con atajos 1-6 y enfriamiento de relevo.
 * Subsección de `PokemonPanel`: cuadrícula 3×2 de tarjetas del mismo tamaño
 * (estilos en `ui/gameUi.css`).
 */

import type { Cooldowns6, Team6 } from '../../core/types';
import { POKEDEX } from '../../data/pokemon';
import { portraitUrl } from '../pokeAssets';
import { TypeChip } from './TypeChip';
import { StarRow } from './StarRow';
import { MAX_STARS } from '../../config/balance.config';
import { starsOf } from '../../core/passives';
import { describePassive } from '../passiveText';

interface Props {
  team: Team6;
  hotSwapCooldowns: Cooldowns6;
  /** Unified Team Level, shared by all six slots (PRD §4.1). */
  teamLevel: number;
  onHotSwap: (index: number) => void;
  gameState?: { phase?: string };
}

const hpColor = (r: number) => (r > 0.5 ? '#48c048' : r >= 0.25 ? '#f8d030' : '#f04040');

export function TeamBar({ team, hotSwapCooldowns, teamLevel, onHotSwap, gameState }: Props) {
  const notInCombat = gameState
    ? gameState.phase !== 'COMBAT' && gameState.phase !== 'PLAYING'
    : false;
  const occupied = team.filter((s) => s.pokemon !== null).length;

  return (
    <section class="gx-sub gx-team team-bar">
      <div class="gx-sl team-bar-header">
        <span>EQUIPO</span>
        <span>
          {occupied}/{team.length}
        </span>
      </div>
      <div class="gx-team-grid team-bar-grid">
        {team.map((slot, i) => {
          const pkm = slot.pokemon;
          const isFainted = !pkm ? false : (!pkm.alive || pkm.hp <= 0);
          const cooldown = hotSwapCooldowns[i];
          const onCooldown = cooldown > 0;
          const disabled = !pkm || isFainted || onCooldown || notInCombat;
          const hpRatio = pkm && pkm.maxHp > 0 ? Math.max(0, Math.min(1, pkm.hp / pkm.maxHp)) : 0;
          const stars = starsOf(pkm);
          const apex = !!pkm && stars >= MAX_STARS;
          const passive = pkm ? POKEDEX[pkm.definitionId].benchPassive : null;
          const passiveText =
            pkm && passive && stars >= 2 ? describePassive(passive.stat, passive.value * (apex ? 2 : 1)) : '';
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onHotSwap(i)}
              title={passiveText ? `Pasiva: ${passiveText}${isFainted ? ' (OFF)' : ''}` : undefined}
              data-testid={`team-slot-${i}`}
              class={`gx-btn gx-slot team-slot-btn ${slot.isActive ? 'is-hot' : ''} ${isFainted ? 'is-fainted' : ''}`}
              style={apex ? { borderColor: '#e0a000', boxShadow: '0 var(--bw) 0 #e0a000, 0 0 8px #ffd860' } : undefined}
            >
              <span class="gx-slot-idx">{i + 1}</span>
              <span class="gx-slot-pic">
                {pkm ? (
                  <img
                    class={`pk-sprite gx-slot-img ${isFainted ? 'grayscale opacity-50' : ''}`}
                    src={portraitUrl(pkm.definitionId)}
                    alt=""
                    width={40}
                    height={40}
                  />
                ) : (
                  <span class="pk-ball gx-slot-img opacity-30" />
                )}
              </span>
              <span class="gx-slot-line">
                <span class="gx-slot-name" title={pkm ? POKEDEX[pkm.definitionId].name : undefined}>
                  {pkm ? POKEDEX[pkm.definitionId].name : '—'}
                </span>
                <span class="gx-num gx-slot-lv">Nv {teamLevel}</span>
              </span>
              <span class="gx-slot-line">
                {pkm ? <TypeChip type={pkm.types[0]} /> : <span class="pk-chip" style={{ visibility: 'hidden' }}>—</span>}
                {pkm ? <StarRow stars={stars} size="0.55em" /> : <span />}
              </span>
              <span class="gx-bar">
                <span style={{ width: `${hpRatio * 100}%`, background: hpColor(hpRatio) }} />
              </span>
              {isFainted ? (
                <span class="gx-slot-foot is-off">DEBILITADO</span>
              ) : (
                <span class="gx-slot-foot">{passiveText && <span>{passiveText}</span>}</span>
              )}
              {onCooldown && <span class="gx-num gx-slot-cd">{cooldown.toFixed(1)}s</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
