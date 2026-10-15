import { useGameStore } from './store';
import { getPokemonDef } from '../core/evolution';

const TYPE_COLORS: Record<string, string> = {
  FIRE: 'bg-red-600', WATER: 'bg-blue-600', GRASS: 'bg-green-600',
  ELECTRIC: 'bg-yellow-500', PSYCHIC: 'bg-pink-600', GHOST: 'bg-purple-700',
  ROCK: 'bg-yellow-800', GROUND: 'bg-amber-700', POISON: 'bg-purple-600',
  FIGHTING: 'bg-red-800', FLYING: 'bg-indigo-400', DRAGON: 'bg-violet-700',
  STEEL: 'bg-gray-400', DARK: 'bg-gray-700', BUG: 'bg-lime-600',
  ICE: 'bg-cyan-400', FAIRY: 'bg-pink-400', NORMAL: 'bg-gray-500',
};

export function TeamBar() {
  const team = useGameStore(s => s.team);
  const activeIndex = useGameStore(s => s.activeIndex);
  const dispatch = useGameStore(s => s.dispatch);

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Equipo (Hot-Swap 1-6)</h3>
      <div className="grid grid-cols-1 gap-1">
        {team.map((member, i) => {
          if (!member) return (
            <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-gray-800/50 border border-gray-800 opacity-40">
              <span className="text-gray-600 text-xs w-4 font-mono">{i + 1}</span>
              <div className="w-6 h-6 rounded bg-gray-800" />
              <span className="text-gray-600 text-xs">Vacío</span>
            </div>
          );

          const def = getPokemonDef(member.currentEvolutionId);
          const isActive = i === activeIndex;
          const onCooldown = member.switchCooldown > 0;
          const hpRatio = member.hp / member.maxHp;

          return (
            <button
              key={i}
              onClick={() => !isActive && !onCooldown && dispatch({ type: 'HOT_SWAP', index: i })}
              disabled={isActive || onCooldown}
              className={`flex items-center gap-2 p-1.5 rounded border transition-all ${
                isActive
                  ? 'bg-yellow-900/30 border-yellow-500 shadow-sm shadow-yellow-500/20'
                  : onCooldown
                  ? 'bg-gray-800/50 border-gray-700 opacity-60 cursor-not-allowed'
                  : 'bg-gray-800 border-gray-700 hover:border-green-500 cursor-pointer'
              }`}
            >
              <span className="text-gray-400 text-xs w-4 font-mono">{i + 1}</span>
              {/* Mini portrait */}
              <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white ${TYPE_COLORS[def?.types[0] || 'NORMAL']}`}>
                {def?.name?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className={`text-xs font-semibold truncate ${isActive ? 'text-yellow-400' : 'text-white'}`}>
                    {def?.name || '???'}
                  </span>
                  {isActive && <span className="text-[8px] bg-yellow-600 text-black px-1 rounded font-bold">ACTIVO</span>}
                </div>
                {/* HP bar */}
                <div className="h-1.5 bg-gray-900 rounded-full mt-0.5">
                  <div
                    className={`h-full rounded-full transition-all ${hpRatio > 0.5 ? 'bg-green-500' : hpRatio > 0.2 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.max(0, hpRatio * 100)}%` }}
                  />
                </div>
              </div>
              {onCooldown && (
                <span className="text-[9px] text-gray-500 font-mono">
                  {Math.ceil(member.switchCooldown)}s
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
