/**
 * PokéBastion — Santuario de Invocación (gacha, PRD §3.1): tiradas con Sellos
 * de Reclutamiento, tasas por rareza y contador de Pity.
 */

import {
  GACHA_MULTI_PULL,
  GACHA_PITY_EPIC,
  GACHA_PITY_LEGENDARY,
  GACHA_PULL_COST,
  GACHA_RATES,
} from '../../config/balance.config';
import { pullsUntilGuarantee } from '../../core/gacha';
import { RARITIES } from '../../core/types';
import { POKEDEX } from '../../data/pokemon';
import { useMetaStore } from '../metaStore';
import { portraitUrl } from '../pokeAssets';
import { RARITY_COLOR, RARITY_LABEL, RARITY_TIER } from '../rarity';

export function GachaSanctuary() {
  const meta = useMetaStore((s) => s.meta);
  const lastPull = useMetaStore((s) => s.lastPull);
  const pull = useMetaStore((s) => s.pull);
  const until = pullsUntilGuarantee(meta.pity);

  const canOne = meta.seals >= GACHA_PULL_COST;
  const canTen = meta.seals >= GACHA_PULL_COST * GACHA_MULTI_PULL;

  return (
    <div class="flex min-h-0 flex-col gap-3">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="pk-dark flex items-center justify-between p-3 text-[10px]">
          <span>SELLOS</span>
          <span class="flex items-center gap-2">
            <span class="pk-ball pk-ball-gold" />
            <span class="pk-num text-2xl" data-testid="seals">{meta.seals}</span>
          </span>
        </div>
        <div class="pk-dark flex flex-col gap-1 p-3 text-[8px] leading-relaxed">
          <span>★★★+ GARANTIZADO EN <b class="text-[#ffd860]">{until.epic}</b> / {GACHA_PITY_EPIC}</span>
          <span>★★★★ GARANTIZADO EN <b class="text-[#ffd860]">{until.legendary}</b> / {GACHA_PITY_LEGENDARY}</span>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <button type="button" class="pk-btn px-3 py-3 text-[10px]" disabled={!canOne} onClick={() => pull(1)} data-testid="pull-1">
          INVOCAR ×1
          <span class="pk-num block text-lg">{GACHA_PULL_COST} sello</span>
        </button>
        <button type="button" class="pk-btn pk-btn-active px-3 py-3 text-[10px]" disabled={!canTen} onClick={() => pull(GACHA_MULTI_PULL)} data-testid="pull-10">
          INVOCAR ×{GACHA_MULTI_PULL}
          <span class="pk-num block text-lg">{GACHA_PULL_COST * GACHA_MULTI_PULL} sellos</span>
        </button>
      </div>
      {!canOne && (
        <p class="text-[8px] leading-relaxed text-[#803030]">
          Sin sellos. Gana más derrotando Mini-Bosses por primera vez y alcanzando pisos altos.
        </p>
      )}

      <div class="flex flex-wrap gap-2 text-[8px]">
        {RARITIES.map((r) => (
          <span key={r} class="pk-chip" style={{ backgroundColor: RARITY_COLOR[r] }}>
            {'★'.repeat(RARITY_TIER[r])} RANGO {RARITY_LABEL[r]} {Math.round(GACHA_RATES[r] * 100)}%
          </span>
        ))}
      </div>

      <div
        class="pk-dark min-h-[120px] overflow-y-auto p-3"
        style={{ maxHeight: '38vh', scrollbarWidth: 'thin' }}
        data-testid="pull-results"
      >
        {!lastPull && <p class="text-[9px] text-[#a8c0e0]">Realiza una invocación para reclutar Pokémon.</p>}
        <ul class="flex flex-col gap-2">
          {lastPull?.map((o, i) => (
            <li key={i} class="flex items-center gap-3 text-[9px]">
              <img class="pk-sprite h-10 w-10 shrink-0" src={portraitUrl(o.speciesId)} alt="" width={40} height={40} />
              <span class="flex-1 truncate">{POKEDEX[o.speciesId].name.toUpperCase()}</span>
              <span class="pk-chip" style={{ backgroundColor: RARITY_COLOR[o.rarity] }}>{'★'.repeat(RARITY_TIER[o.rarity])}</span>
              <span class={o.isNew ? 'text-[#ffd860]' : 'text-[#a8c0e0]'}>
                {o.isNew ? '¡NUEVO!' : `+${o.fragmentsGained} FRAG.`}
              </span>
              {o.guaranteedBy && <span class="text-[#58b0f8]" title="Garantizado por Pity">PITY</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
