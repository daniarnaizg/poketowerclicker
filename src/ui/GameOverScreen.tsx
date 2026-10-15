import { useGameStore } from './store';
import { getPokemonDef } from '../core/evolution';

export function GameOverScreen() {
  const floor = useGameStore(s => s.floor);
  const runaEarned = useGameStore(s => s.runaEarned);
  const totalKills = useGameStore(s => s.totalKills);
  const elapsedSec = useGameStore(s => s.elapsedSec);
  const team = useGameStore(s => s.team);
  const dispatch = useGameStore(s => s.dispatch);

  const minutes = Math.floor(elapsedSec / 60);
  const seconds = Math.floor(elapsedSec % 60);

  // Find MVP (most kills contribution - simplified: just show first active)
  const activeMember = team.find((m, i) => i === 0 && m !== null);
  const mvpDef = activeMember ? getPokemonDef(activeMember.currentEvolutionId) : null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="bg-gray-900 border-2 border-red-600 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl shadow-red-900/20">
        <h2 className="text-2xl font-bold text-center text-red-500 mb-1">
          ¡Fin de la Expedición!
        </h2>
        <p className="text-gray-500 text-center text-xs mb-4">
          Tu bastión ha caído...
        </p>

        {/* Trainer Card */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 text-xs block">Piso Alcanzado</span>
              <span className="text-white font-bold text-lg">{floor}</span>
            </div>
            <div>
              <span className="text-gray-500 text-xs block">Enemigos Abatidos</span>
              <span className="text-white font-bold text-lg">{totalKills}</span>
            </div>
            <div>
              <span className="text-gray-500 text-xs block">Tiempo</span>
              <span className="text-white font-bold">{minutes}:{String(seconds).padStart(2, '0')}</span>
            </div>
            <div>
              <span className="text-gray-500 text-xs block">MVP</span>
              <span className="text-yellow-400 font-bold text-sm">{mvpDef?.name || '—'}</span>
            </div>
          </div>
        </div>

        {/* Runa earned */}
        <div className="text-center mb-4">
          <span className="text-gray-400 text-xs block mb-1">Runas Ancestrales Ganadas</span>
          <div className="text-3xl font-bold text-purple-400">
            ✦ {runaEarned}
          </div>
          <span className="text-purple-600 text-[10px]">
            +{runaEarned * 4}% daño global permanente
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => dispatch({ type: 'RESTART' })}
            className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold transition-colors cursor-pointer"
          >
            Nueva Expedición
          </button>
          <button
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors cursor-pointer"
            onClick={() => {
              // Share placeholder
              const text = `🏰 PokéBastion — Piso ${floor} | ${totalKills} enemigos | ✦${runaEarned} Runas`;
              navigator.clipboard?.writeText(text);
            }}
          >
            Compartir 📋
          </button>
        </div>
      </div>
    </div>
  );
}
