/**
 * PokéBastion — Santuario de Invocación (gacha, PRD §3.1): tiradas con Sellos
 * de Reclutamiento, tasas por rareza, contadores de garantía y resultados.
 * Los resultados van en dos columnas para que una tirada ×10 quepa sin scroll.
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

function PityBar({ label, left, max }: { label: string; left: number; max: number }) {
  const pct = Math.max(0, Math.min(100, ((max - left) / max) * 100));
  return (
    <div class="flex flex-col gap-1">
      <span>
        {label} en <b class="text-[#ffd860]">{left}</b>
        <span class="text-[#a8c0e0]">/{max}</span>
      </span>
      <span class="block h-1.5 w-full bg-[#585858]">
        <span class="block h-full bg-[#ffd860]" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

export function GachaSanctuary() {
  const meta = useMetaStore((s) => s.meta);
  const lastPull = useMetaStore((s) => s.lastPull);
  const pull = useMetaStore((s) => s.pull);
  const until = pullsUntilGuarantee(meta.pity);

  const canOne = meta.seals >= GACHA_PULL_COST;
  const canTen = meta.seals >= GACHA_PULL_COST * GACHA_MULTI_PULL;

  return (
    <div class="flex h-full min-h-0 flex-col gap-2 lg:grid lg:grid-cols-[19rem_1fr] lg:gap-4">
      <div class="flex flex-none flex-col gap-2">
        <div class="grid grid-cols-2 gap-3">
          <div class="pk-dark flex flex-col justify-center gap-1 p-2.5 text-[9px]">
            <span class="text-[#a8c0e0]">SELLOS</span>
            <span class="flex items-center gap-2">
              <span class="pk-ball pk-ball-gold" />
              <span class="pk-num text-2xl" data-testid="seals">{meta.seals}</span>
            </span>
          </div>
          <div class="pk-dark flex flex-col gap-1.5 p-2.5 text-[8px] leading-tight" title="Invocaciones que faltan para asegurar ese rango">
            <span class="text-[#a8c0e0]">GARANTIZADO</span>
            <PityBar label="★★★+" left={until.epic} max={GACHA_PITY_EPIC} />
            <PityBar label="★★★★" left={until.legendary} max={GACHA_PITY_LEGENDARY} />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <button type="button" class="pk-btn px-2 py-2 text-[10px]" disabled={!canOne} onClick={() => pull(1)} data-testid="pull-1">
            INVOCAR ×1
            <span class="pk-num block text-lg">{GACHA_PULL_COST} sello</span>
          </button>
          <button type="button" class="pk-btn pk-btn-active px-2 py-2 text-[10px]" disabled={!canTen} onClick={() => pull(GACHA_MULTI_PULL)} data-testid="pull-10">
            INVOCAR ×{GACHA_MULTI_PULL}
            <span class="pk-num block text-lg">{GACHA_PULL_COST * GACHA_MULTI_PULL} sellos</span>
          </button>
        </div>
        {!canOne && (
          <p class="text-[8px] leading-relaxed text-[#803030]">
            Sin sellos. Gana más derrotando Mini-Bosses por primera vez y alcanzando pisos altos.
          </p>
        )}

        <div class="flex flex-wrap gap-1.5 text-[8px]" aria-label="Probabilidades por rango">
          {RARITIES.map((r) => (
            <span key={r} class="pk-chip" style={{ backgroundColor: RARITY_COLOR[r] }} title={`Rango ${RARITY_LABEL[r]}`}>
              {'★'.repeat(RARITY_TIER[r])} {Math.round(GACHA_RATES[r] * 100)}%
            </span>
          ))}
        </div>
      </div>

      <div class="pk-dark min-h-0 flex-1 overflow-y-auto p-2.5" style={{ scrollbarWidth: 'thin' }} data-testid="pull-results">
        {!lastPull && (
          <p class="p-1 text-[9px] leading-relaxed text-[#a8c0e0]">Realiza una invocación para reclutar Pokémon.</p>
        )}
        {lastPull && (
          <ul class={`grid gap-2 ${lastPull.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {lastPull.map((o, i) => (
              <li
                key={i}
                class="flex min-w-0 items-center gap-2 border-l-4 bg-[#3c3c3c] p-1.5"
                style={{ borderColor: o.isNew ? '#ffd860' : RARITY_COLOR[o.rarity] }}
              >
                <img class="pk-sprite h-9 w-9 shrink-0" src={portraitUrl(o.speciesId)} alt="" width={36} height={36} />
                <div class="flex min-w-0 flex-1 flex-col gap-1 text-[8px] sm:text-[9px]">
                  <span class="truncate">{POKEDEX[o.speciesId].name.toUpperCase()}</span>
                  <span class="flex items-center gap-1.5">
                    <span class="pk-chip !px-1 !py-0.5 !text-[8px]" style={{ backgroundColor: RARITY_COLOR[o.rarity] }}>
                      {'★'.repeat(RARITY_TIER[o.rarity])}
                    </span>
                    <span class={`whitespace-nowrap ${o.isNew ? 'text-[#ffd860]' : 'text-[#a8c0e0]'}`}>
                      {o.isNew ? '¡NUEVO!' : `+${o.fragmentsGained} FRAG.`}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
