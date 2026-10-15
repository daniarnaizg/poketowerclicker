import { STARTER_CHOICES } from '../data/starters';
import { useGameStore } from './store';

const TYPE_COLORS: Record<string, string> = {
  FIRE: 'bg-red-600', WATER: 'bg-blue-600', GRASS: 'bg-green-600',
  ELECTRIC: 'bg-yellow-500', PSYCHIC: 'bg-pink-600', GHOST: 'bg-purple-700',
  ROCK: 'bg-yellow-800', GROUND: 'bg-amber-700', POISON: 'bg-purple-600',
  FIGHTING: 'bg-red-800', FLYING: 'bg-indigo-400', DRAGON: 'bg-violet-700',
  STEEL: 'bg-gray-400', DARK: 'bg-gray-700', BUG: 'bg-lime-600',
  ICE: 'bg-cyan-400', FAIRY: 'bg-pink-400', NORMAL: 'bg-gray-500',
};

export function StarterSelection() {
  const dispatch = useGameStore(s => s.dispatch);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 border-2 border-yellow-500 rounded-xl p-8 max-w-lg w-full mx-4">
        <h2 className="text-2xl font-bold text-center text-yellow-400 mb-2">
          ¡Elige tu Pokémon Inicial!
        </h2>
        <p className="text-gray-400 text-center text-sm mb-6">
          Este será tu primer combatiente en la arena
        </p>
        <div className="grid grid-cols-3 gap-4">
          {STARTER_CHOICES.map(starter => (
            <button
              key={starter.id}
              onClick={() => dispatch({ type: 'SELECT_STARTER', pokemonId: starter.id })}
              className="group flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-700 hover:border-yellow-500 transition-colors bg-gray-800 hover:bg-gray-700"
            >
              {/* Placeholder sprite */}
              <div className={`w-16 h-16 rounded-lg ${TYPE_COLORS[starter.types[0]]} flex items-center justify-center text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform`}>
                {starter.name[0]}
              </div>
              <span className="text-white font-semibold text-sm">{starter.name}</span>
              <div className="flex gap-1">
                {starter.types.map(t => (
                  <span key={t} className={`px-1.5 py-0.5 rounded text-[10px] text-white ${TYPE_COLORS[t]}`}>
                    {t}
                  </span>
                ))}
              </div>
              <span className="text-gray-500 text-[10px]">{starter.pattern}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
