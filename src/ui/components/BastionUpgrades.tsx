/**
 * PokéBastion — bastion upgrade panel: Team Level, gold and the 8 upgrades.
 */

import {
  ARROW_DAMAGE_PER_LEVEL,
  BASTION_REGEN_FRACTION_PER_SEC,
  CRIT_CHANCE_PER_UP_CRIT,
  GOLD_PER_LEVEL,
  HP_PER_LEVEL,
  MULTI_MAX,
  SPD_PER_LEVEL,
  teamLevelCost,
  upgradeCost,
} from '../../config/balance.config';
import { BASTION_UPGRADE_IDS } from '../../core/types';
import type { BastionUpgradeId, BastionUpgrades as BastionUpgradeLevels } from '../../core/types';

interface Props {
  upgrades: BastionUpgradeLevels;
  gold: number;
  teamLevel: number;
  onPurchase: (id: BastionUpgradeId) => void;
  onBuyTeamLevel: () => void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
/** shortcut: visual level bar caps at 10; raise if upgrades ever exceed it. */
const LEVEL_BAR_MAX = 10;

const UPGRADE_INFO: Record<BastionUpgradeId, { name: string; effect: string }> = {
  UP_CLICK: { name: 'Daño de clic', effect: 'Aumenta el daño de tus clics' },
  UP_HP: { name: 'Muralla', effect: `+${HP_PER_LEVEL} HP · regen ${pct(BASTION_REGEN_FRACTION_PER_SEC)}/s` },
  UP_MULTI: { name: 'Multidisparo', effect: `+1 disparo/rebote (máx ${MULTI_MAX})` },
  UP_ARROW: { name: 'Flechas', effect: `+${pct(ARROW_DAMAGE_PER_LEVEL)} daño de proyectil` },
  UP_SPD: { name: 'Cadencia', effect: `+${pct(SPD_PER_LEVEL)} velocidad de ataque` },
  UP_CRIT: { name: 'Precisión', effect: `+${pct(CRIT_CHANCE_PER_UP_CRIT)} prob. de crítico` },
  UP_CDMG: { name: 'Furia', effect: '+10% daño crítico' },
  UP_GOLD: { name: 'Codicia', effect: `+${pct(GOLD_PER_LEVEL)} oro` },
};

export function BastionUpgrades({ upgrades, gold, teamLevel, onPurchase, onBuyTeamLevel }: Props) {
  const teamCost = teamLevelCost(teamLevel);
  return (
    <div class="flex w-64 flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900/90 p-3 text-white">
      <div class="flex items-center justify-between">
        <span class="text-sm font-semibold uppercase tracking-wide text-slate-400">Bastión</span>
        <span class="font-bold text-amber-400">🪙 {gold}</span>
      </div>

      <button
        type="button"
        onClick={onBuyTeamLevel}
        disabled={gold < teamCost}
        class="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left transition enabled:hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>
          <span class="block text-sm font-semibold">Nivel de equipo</span>
          <span class="block text-xs text-slate-400">
            Nv {teamLevel} → {teamLevel + 1}
          </span>
        </span>
        <span class="text-sm font-bold text-amber-400">{teamCost} 🪙</span>
      </button>

      <div class="flex flex-col gap-1.5">
        {BASTION_UPGRADE_IDS.map((id) => {
          const level = upgrades[id];
          const cost = upgradeCost(id, level);
          const affordable = gold >= cost;
          const info = UPGRADE_INFO[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPurchase(id)}
              disabled={!affordable}
              class="flex flex-col gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-left transition enabled:hover:border-amber-500/60 enabled:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span class="flex items-center justify-between text-sm font-semibold">
                <span>{info.name}</span>
                <span class="text-xs text-slate-400">Nv {level}</span>
              </span>
              <span class="text-xs text-slate-400">{info.effect}</span>
              <span class="flex items-center gap-2">
                <span class="h-1.5 flex-1 overflow-hidden rounded bg-slate-700">
                  <span
                    class="block h-full bg-sky-400"
                    style={{ width: `${Math.min(level, LEVEL_BAR_MAX) / LEVEL_BAR_MAX * 100}%` }}
                  />
                </span>
                <span class="text-xs font-bold text-amber-400">{cost} 🪙</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
