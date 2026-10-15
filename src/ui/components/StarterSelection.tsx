/**
 * PokéBastion — starter picker modal shown during the STARTER_SELECT phase.
 */

import { STARTER_IDS } from '../../config/balance.config';
import { POKEDEX } from '../../data/pokemon';
import { TYPE_COLORS } from '../typeColors';

export function StarterSelection({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div class="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h1 class="text-center text-2xl font-bold text-white">Elige tu Pokémon inicial</h1>
        <p class="mt-1 text-center text-sm text-slate-400">
          Los otros dos formarán tu banquillo.
        </p>
        <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STARTER_IDS.map((id) => {
            const def = POKEDEX[id];
            const color = TYPE_COLORS[def.types[0]];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                style={{ borderColor: color }}
                class="group flex flex-col items-center rounded-xl border-2 bg-slate-800/80 p-4 transition hover:-translate-y-1 hover:bg-slate-700"
              >
                <span class="h-16 w-16 rounded-full" style={{ backgroundColor: color }} />
                <span class="mt-3 text-lg font-semibold text-white">{def.name}</span>
                <span
                  class="text-xs uppercase tracking-wide"
                  style={{ color }}
                >
                  {def.types.join(' / ')}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
