/**
 * PokéBastion — equipo de 6 con atajos 1-6 y enfriamiento de relevo.
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
}

const hpColor = (r: number) => (r > 0.5 ? '#48c048' : r >= 0.25 ? '#f8d030' : '#f04040');

export function TeamBar({ team, hotSwapCooldowns, teamLevel, onHotSwap }: Props) {
  return (
    <div class="pk-window shrink-0 p-3">
      <div class="mb-3 flex items-center gap-2 text-[11px]">
        <span class="pk-ball" /> EQUIPO
      </div>
      <div class="grid grid-cols-3 gap-2.5">
        {team.map((slot, i) => {
          const pkm = slot.pokemon;
          const cooldown = hotSwapCooldowns[i];
          const onCooldown = cooldown > 0;
          const disabled = !pkm || onCooldown;
          const hpRatio = pkm && pkm.maxHp > 0 ? Math.max(0, Math.min(1, pkm.hp / pkm.maxHp)) : 0;
          const stars = starsOf(pkm);
          const shiny = !!pkm && stars >= MAX_STARS;
          const passive = pkm ? POKEDEX[pkm.definitionId].benchPassive : null;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onHotSwap(i)}
              title={pkm && passive && stars >= 2 ? `Pasiva: ${describePassive(passive.stat, passive.value * (shiny ? 2 : 1))}` : undefined}
              data-testid={`team-slot-${i}`}
              class={`pk-btn relative flex flex-col items-center gap-1 px-1 py-2 text-[9px] ${
                slot.isActive ? 'pk-btn-active' : ''
              }`}
              style={shiny ? { borderColor: '#e0a000', boxShadow: '0 4px 0 #e0a000, 0 0 8px #ffd860' } : undefined}
            >
              <span class="absolute left-1 top-1 text-[9px]">{i + 1}</span>
              {pkm ? (
                <img
                  class="pk-sprite h-10 w-10"
                  src={portraitUrl(pkm.definitionId)}
                  alt=""
                  width={40}
                  height={40}
                />
              ) : (
                <span class="pk-ball h-10 w-10 opacity-30" />
              )}
              <span class="w-full truncate text-center text-[8px]" title={pkm ? POKEDEX[pkm.definitionId].name : undefined}>
                {pkm ? POKEDEX[pkm.definitionId].name : '—'}
              </span>
              {pkm && <TypeChip type={pkm.types[0]} />}
              {pkm && <StarRow stars={stars} size={7} />}
              <span class="pk-num">Nv {teamLevel}</span>
              <span class="pk-bar w-full">
                <span style={{ width: `${hpRatio * 100}%`, background: hpColor(hpRatio) }} />
              </span>
              {onCooldown && (
                <span class="pk-num absolute inset-0 flex items-center justify-center bg-black/65 text-2xl text-white">
                  {cooldown.toFixed(1)}s
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
