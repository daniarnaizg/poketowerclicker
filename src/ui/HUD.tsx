import { useGameStore } from './store';

export function HUD() {
  const floor = useGameStore(s => s.floor);
  const waveTimerSec = useGameStore(s => s.waveTimerSec);
  const bastionHp = useGameStore(s => s.bastionHp);
  const bastionMaxHp = useGameStore(s => s.bastionMaxHp);
  const bossActive = useGameStore(s => s.bossActive);
  const ultimateCharge = useGameStore(s => s.ultimateCharge);
  const gold = useGameStore(s => s.gold);
  const dispatch = useGameStore(s => s.dispatch);

  const hpRatio = bastionHp / bastionMaxHp;

  return (
    <div className="space-y-2">
      {/* Floor & Timer */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-white">Piso {floor}</span>
        <span className={`text-xs font-mono ${bossActive ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>
          {bossActive ? '⚔ BOSS' : ''} {Math.ceil(waveTimerSec)}s
        </span>
      </div>

      {/* Bastion HP */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>HP Bastión</span>
          <span>{Math.floor(bastionHp)}/{bastionMaxHp}</span>
        </div>
        <div className="h-3 bg-gray-900 rounded-full border border-gray-700">
          <div
            className={`h-full rounded-full transition-all ${hpRatio > 0.5 ? 'bg-green-600' : hpRatio > 0.25 ? 'bg-yellow-600' : 'bg-red-600'}`}
            style={{ width: `${Math.max(0, hpRatio * 100)}%` }}
          />
        </div>
      </div>

      {/* Ultimate */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>Definitiva</span>
          <span>{Math.floor(ultimateCharge * 100)}%</span>
        </div>
        <div className="h-2.5 bg-gray-900 rounded-full border border-gray-700">
          <div
            className="h-full rounded-full bg-purple-600 transition-all"
            style={{ width: `${ultimateCharge * 100}%` }}
          />
        </div>
        <button
          onClick={() => dispatch({ type: 'USE_ULTIMATE' })}
          disabled={ultimateCharge < 1}
          className={`w-full mt-1 py-1 rounded text-[10px] font-bold transition-colors ${
            ultimateCharge >= 1
              ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          {ultimateCharge >= 1 ? '¡USA DEFINITIVA! [Espacio]' : 'Cargando...'}
        </button>
      </div>

      {/* Gold */}
      <div className="flex items-center gap-2 bg-yellow-900/20 rounded px-2 py-1 border border-yellow-800/30">
        <span className="text-yellow-400 text-sm">🪙</span>
        <span className="text-yellow-300 font-bold text-sm">{Math.floor(gold)}</span>
        <span className="text-yellow-600 text-[10px]">oro</span>
      </div>
    </div>
  );
}
