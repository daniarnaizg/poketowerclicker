/**
 * PokéBastion — bastion upgrade panel: Team Level, gold and the 9 upgrades.
 */

import {
  ARROW_DAMAGE_PER_LEVEL,
  AUTOCLICK_CPS_BY_LEVEL,
  AUTO_SPD_BASE_MULT,
  CRIT_CHANCE_PER_UP_CRIT,
  GOLD_PER_LEVEL,
  MULTI_MAX_LEVEL,
  SPD_PER_LEVEL,
  teamLevelCost,
  upgradeCost,
  upgradeMaxLevel,
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
  UP_MULTI: { name: 'Multidisparo', effect: `+1 disparo autónomo del Pokémon (máx ${MULTI_MAX_LEVEL} mejoras)` },
  UP_ARROW: { name: 'Proyectiles', effect: `+${pct(ARROW_DAMAGE_PER_LEVEL)} daño de proyectil (manual y auto)` },
  UP_SPD: { name: 'Cadencia Auto', effect: `+${pct(SPD_PER_LEVEL)} velocidad de disparo autónomo (base ${pct(AUTO_SPD_BASE_MULT)})` },
  UP_CRIT: { name: 'Precisión', effect: `+${pct(CRIT_CHANCE_PER_UP_CRIT)} prob. de crítico` },
  UP_CDMG: { name: 'Furia', effect: '+10% daño crítico' },
  UP_GOLD: { name: 'Codicia', effect: `+${pct(GOLD_PER_LEVEL)} oro` },
  UP_AUTOCLICK: { name: 'Autoclick', effect: 'Dispara proyectiles hacia donde esté tu cursor' },
};

export function BastionUpgrades({ upgrades, gold, teamLevel, onPurchase, onBuyTeamLevel }: Props) {
  const teamCost = teamLevelCost(teamLevel);
  return (
    <div class="pk-window flex min-h-[18rem] flex-1 flex-col gap-2.5 p-3">
      <div class="flex shrink-0 items-center justify-between text-[11px]">
        <span>MEJORAS</span>
        <span class="flex items-center gap-2">
          <span class="pk-ball pk-ball-gold" /> {gold}
        </span>
      </div>

      <button
        type="button"
        onClick={onBuyTeamLevel}
        disabled={gold < teamCost}
        class="pk-btn pk-btn-active flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-left text-[10px]"
      >
        <span>
          NIVEL EQUIPO
          <span class="pk-num block">Nv {teamLevel} → {teamLevel + 1}</span>
        </span>
        <span>{teamCost}</span>
      </button>

      <div
        class="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto overflow-x-hidden pb-2 pr-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {BASTION_UPGRADE_IDS.map((id) => {
          const level = upgrades[id] ?? 0;
          const maxLevel = upgradeMaxLevel(id);
          const isMax = maxLevel !== undefined && level >= maxLevel;
          const barCap = maxLevel ?? LEVEL_BAR_MAX;
          const cost = upgradeCost(id, level);
          const info = UPGRADE_INFO[id];
          const cps = AUTOCLICK_CPS_BY_LEVEL[level] ?? 0;
          return (
            <button
              key={id}
              type="button"
              title={info.effect}
              onClick={() => onPurchase(id)}
              disabled={isMax || gold < cost}
              class="pk-btn flex flex-col gap-1 px-2 py-2 text-left"
            >
              <span class="flex w-full min-w-0 items-center justify-between gap-1">
                <span class="truncate text-[10px] leading-tight text-[#303030]">{info.name}</span>
                <span class="flex shrink-0 items-center gap-1 text-[10px] text-[#303030]">
                  {isMax ? (
                    <span class="text-[9px] font-bold text-[#888]">MAX</span>
                  ) : (
                    <>
                      <span
                        class="pk-ball pk-ball-gold"
                        style={{ width: '12px', height: '12px', borderWidth: '2px' }}
                      />
                      {cost}
                    </>
                  )}
                </span>
              </span>
              {id === 'UP_AUTOCLICK' && (
                <span class="text-[9px] text-[#555]">
                  {cps} clics/s
                </span>
              )}
              {id === 'UP_MULTI' && (
                <span class="text-[9px] text-[#555]">
                  {1 + level} disp. auto
                </span>
              )}
              {id === 'UP_SPD' && (
                <span class="text-[9px] text-[#555]">
                  {pct(AUTO_SPD_BASE_MULT + level * SPD_PER_LEVEL)} cadencia
                </span>
              )}
              <span class="flex w-full items-center gap-1.5">
                <span class="pk-bar flex-1" style={{ height: '8px' }}>
                  <span
                    style={{
                      width: `${(Math.min(level, barCap) / barCap) * 100}%`,
                      background: '#58b0f8',
                    }}
                  />
                </span>
                <span class="shrink-0 text-[9px] font-bold text-[#303030]">
                  Nv {level}{maxLevel ? `/${maxLevel}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
