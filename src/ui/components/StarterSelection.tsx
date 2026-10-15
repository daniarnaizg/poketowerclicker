/**
 * PokéBastion — selector de inicial, estilo laboratorio del Profesor.
 */

import { STARTER_IDS } from '../../config/balance.config';
import { POKEDEX } from '../../data/pokemon';
import { portraitUrl } from '../pokeAssets';
import { TypeChip } from './TypeChip';

export function StarterSelection({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: '#e03828',
        backgroundImage: 'linear-gradient(#00000018 50%, transparent 50%)',
        backgroundSize: '100% 8px',
      }}
    >
      <div class="pk-window w-full max-w-3xl p-6 text-center sm:p-8">
        <h1 class="flex items-center justify-center gap-3 text-base leading-relaxed sm:text-xl">
          <span class="pk-ball" /> ¡ELIGE A TU POKÉMON! <span class="pk-ball" />
        </h1>
        <p class="pk-num mt-2 text-2xl" style={{ fontSize: '26px' }}>
          El profesor te ofrece a tu primer compañero.
        </p>
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {STARTER_IDS.map((id) => {
            const def = POKEDEX[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                class="pk-btn flex flex-col items-center gap-3 px-2 py-5"
              >
                <img
                  class="pk-sprite h-24 w-24"
                  src={portraitUrl(id)}
                  alt={def.name}
                  width={96}
                  height={96}
                />
                <span class="text-xs sm:text-sm">{def.name.toUpperCase()}</span>
                <span class="flex gap-1.5">
                  {def.types.map((t) => (
                    <TypeChip key={t} type={t} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
