import { useGameStore } from './store';
import { getPokemonDef } from '../core/evolution';

const UPGRADE_LABELS: Record<string, { name: string; desc: string; icon: string }> = {
  UP_CLICK: { name: 'Golpe Firme', desc: 'Daño al hacer clic', icon: '👆' },
  UP_HP: { name: 'Vitalidad', desc: 'HP del Bastión', icon: '❤️' },
  UP_MULTI: { name: 'Ataque Múltiple', desc: 'Más objetivos', icon: '🎯' },
  UP_ARROW: { name: 'Potencia Elemental', desc: 'Daño base', icon: '⚡' },
  UP_SPD: { name: 'Cadencia', desc: 'Velocidad de ataque', icon: '💨' },
  UP_CRIT: { name: 'Ojo Certero', desc: 'Prob. crítico', icon: '🎲' },
  UP_CDMG: { name: 'Furia', desc: 'Daño crítico', icon: '💥' },
  UP_GOLD: { name: 'Amuleto Moneda', desc: 'Oro por enemigo', icon: '🪙' },
};

function upgradeCost(level: number): number {
  return Math.floor(10 * Math.pow(1.12, level));
}

export function UpgradePanel() {
  const upgrades = useGameStore(s => s.upgrades);
  const gold = useGameStore(s => s.gold);
  const dispatch = useGameStore(s => s.dispatch);
  const team = useGameStore(s => s.team);
  const activeIndex = useGameStore(s => s.activeIndex);

  const activeMember = team[activeIndex];
  const activeDef = activeMember ? getPokemonDef(activeMember.currentEvolutionId) : null;

  return (
    <div className="space-y-3">
      {/* Team Level */}
      <div className="bg-blue-900/20 rounded-lg p-2 border border-blue-800/30">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-bold text-blue-400">NIVEL DE EQUIPO</span>
          <span className="text-blue-300 font-mono text-sm">Nv. {upgrades.teamLevel}</span>
        </div>
        {activeDef?.evolution && (
          <div className="text-[10px] text-blue-500 mb-1">
            Próxima evo: Nv. {activeDef.evolution.canonicalLevel}
          </div>
        )}
        <button
          onClick={() => dispatch({ type: 'UPGRADE_TEAM_LEVEL' })}
          disabled={gold < upgrades.teamLevelCost}
          className={`w-full py-1.5 rounded text-xs font-bold transition-colors ${
            gold >= upgrades.teamLevelCost
              ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          Subir Nivel — 🪙 {upgrades.teamLevelCost}
        </button>
      </div>

      {/* Bastion Upgrades */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
          Mejoras del Bastión
        </h3>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(UPGRADE_LABELS).map(([key, label]) => {
            const level = (upgrades as any)[key] as number;
            const cost = upgradeCost(level);
            const canAfford = gold >= cost;

            return (
              <button
                key={key}
                onClick={() => dispatch({ type: 'UPGRADE', key: key as any })}
                disabled={!canAfford}
                className={`flex flex-col items-start p-1.5 rounded border text-left transition-colors ${
                  canAfford
                    ? 'bg-gray-800 border-gray-700 hover:border-green-500 cursor-pointer'
                    : 'bg-gray-900 border-gray-800 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-1 w-full">
                  <span className="text-xs">{label.icon}</span>
                  <span className="text-[10px] text-white font-semibold truncate">{label.name}</span>
                </div>
                <div className="flex items-center justify-between w-full mt-0.5">
                  <span className="text-[9px] text-gray-500">Nv. {level}</span>
                  <span className="text-[9px] text-yellow-400">🪙{cost}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
