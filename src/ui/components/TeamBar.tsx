/**
 * PokéBastion — 6-slot team bar with hotkey labels and hot-swap cooldowns.
 */

import type { Cooldowns6, Team6 } from '../../core/types';
import { POKEDEX } from '../../data/pokemon';
import { TYPE_COLORS } from '../typeColors';

interface Props {
  team: Team6;
  hotSwapCooldowns: Cooldowns6;
  /** Unified Team Level, shared by all six slots (PRD §4.1). */
  teamLevel: number;
  onHotSwap: (index: number) => void;
}

export function TeamBar({ team, hotSwapCooldowns, teamLevel, onHotSwap }: Props) {
  return (
    <div class="flex gap-2">
      {team.map((slot, i) => {
        const pkm = slot.pokemon;
        const cooldown = hotSwapCooldowns[i];
        const onCooldown = cooldown > 0;
        const disabled = !pkm || onCooldown;
        const color = pkm ? TYPE_COLORS[pkm.types[0]] : '#475569';
        const hpRatio = pkm && pkm.maxHp > 0 ? Math.max(0, Math.min(1, pkm.hp / pkm.maxHp)) : 0;
        const name = pkm ? POKEDEX[pkm.definitionId].name : '—';
        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onHotSwap(i)}
            style={{ borderColor: slot.isActive ? '#fbbf24' : color }}
            class={`relative flex w-full flex-col items-center rounded-lg border-2 bg-slate-800/80 px-2 py-1.5 transition ${
              slot.isActive ? 'ring-2 ring-amber-400' : 'hover:bg-slate-700'
            } ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
          >
            <span class="absolute left-1 top-1 text-[10px] font-bold text-slate-300">{i + 1}</span>
            <span class="h-6 w-6 rounded-full" style={{ backgroundColor: color }} />
            <span class="mt-1 w-full truncate text-center text-xs font-semibold text-white">
              {name}
            </span>
            <span class="text-[10px] text-amber-300">Nv {teamLevel}</span>
            <span class="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-700">
              <span class="block h-full bg-emerald-400" style={{ width: `${hpRatio * 100}%` }} />
            </span>
            {onCooldown && (
              <span class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60 text-sm font-bold text-white">
                {cooldown.toFixed(1)}s
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
