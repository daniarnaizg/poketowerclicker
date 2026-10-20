/**
 * PokéBastion — panel de mejoras: oro, Nivel de Equipo y las mejoras visibles.
 * Cada mejora es una fila de ancho completo con solo nombre, descripción y precio;
 * las limitadas muestran MAX y se deshabilitan al llegar al tope.
 */

import {
  AUTO_SPD_BASE_MULT,
  CRIT_CHANCE_PER_UP_CRIT,
  GOLD_PER_LEVEL,
  SPD_PER_LEVEL,
  teamLevelCost,
  upgradeCost,
  upgradeMaxLevel,
} from '../../config/balance.config';
import type { BastionUpgradeId, BastionUpgrades as BastionUpgradeLevels } from '../../core/types';

interface Props {
  upgrades: BastionUpgradeLevels;
  gold: number;
  teamLevel: number;
  onPurchase: (id: BastionUpgradeId) => void;
  onBuyTeamLevel: () => void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Orden fijo (por coste base, de menor a mayor) para que las filas no salten al comprar.
 * UP_ARROW y UP_AUTOCLICK siguen ocultas a propósito (se conservan en el núcleo).
 */
const VISIBLE_UPGRADES: readonly BastionUpgradeId[] = ['UP_SPD', 'UP_CRIT', 'UP_CDMG', 'UP_GOLD', 'UP_MULTI'];

const NAMES: Partial<Record<BastionUpgradeId, string>> = {
  UP_SPD: 'Cadencia Auto',
  UP_CRIT: 'Precisión',
  UP_CDMG: 'Furia',
  UP_GOLD: 'Codicia',
  UP_MULTI: 'Multidisparo',
};

/** Valor actual donde tiene sentido (cadencia, disparos); ganancia por nivel en el resto. */
function describe(id: BastionUpgradeId, level: number): string {
  switch (id) {
    case 'UP_SPD':
      return `Actual: ${pct(AUTO_SPD_BASE_MULT + level * SPD_PER_LEVEL)} de cadencia`;
    case 'UP_CRIT':
      return `+${pct(CRIT_CHANCE_PER_UP_CRIT)} de probabilidad crítica por nivel`;
    case 'UP_CDMG':
      return '+10% de daño crítico por nivel';
    case 'UP_GOLD':
      return `+${pct(GOLD_PER_LEVEL)} de oro ganado por nivel`;
    case 'UP_MULTI':
      return `Actual: ${1 + level} ${level === 0 ? 'disparo automático' : 'disparos automáticos'}`;
    default:
      return '';
  }
}

export function BastionUpgrades({ upgrades, gold, teamLevel, onPurchase, onBuyTeamLevel }: Props) {
  const teamCost = teamLevelCost(teamLevel);
  return (
    <div class="gx-win gx-up">
      <div class="gx-title">
        <span>MEJORAS</span>
        <span class="gx-gold">
          <span class="gx-coin" />
          <span class="gx-num gx-gold-n">{gold}</span>
        </span>
      </div>

      <div class="gx-ulist">
        <button
          type="button"
          onClick={onBuyTeamLevel}
          disabled={gold < teamCost}
          class={`gx-btn gx-urow is-team ${gold >= teamCost ? 'can-buy' : ''}`}
        >
          <span class="gx-urow-tx">
            <span class="gx-urow-name">NIVEL EQUIPO</span>
            <span class="gx-urow-desc">
              Sube el equipo de Nv {teamLevel} a Nv {teamLevel + 1}
            </span>
          </span>
          <span class="gx-price">
            <span class="gx-coin" />
            {teamCost}
          </span>
        </button>

        {VISIBLE_UPGRADES.map((id) => {
          const level = upgrades[id] ?? 0;
          const maxLevel = upgradeMaxLevel(id);
          const isMax = maxLevel !== undefined && level >= maxLevel;
          const cost = upgradeCost(id, level);
          const canBuy = !isMax && gold >= cost;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPurchase(id)}
              disabled={!canBuy}
              class={`gx-btn gx-urow ${canBuy ? 'can-buy' : ''} ${isMax ? 'is-max' : ''}`}
            >
              <span class="gx-urow-tx">
                <span class="gx-urow-name">{NAMES[id]}</span>
                <span class="gx-urow-desc">{describe(id, level)}</span>
              </span>
              <span class="gx-price">
                {isMax ? (
                  'MAX'
                ) : (
                  <>
                    <span class="gx-coin" />
                    {cost}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
