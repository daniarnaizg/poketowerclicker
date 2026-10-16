/**
 * PokéBastion — Caja Pokémon: colección, equipo de 6 y Despertar (1★ a 5★).
 * Flujo: elige un Pokémon de la caja y pulsa una ranura del equipo para asignarlo.
 */

import { useState } from 'preact/hooks';
import {
  AWAKEN_FRAGMENT_COST,
  MAX_STARS,
  STAR_BENCH_PASSIVE,
  STAR_PATTERN,
  STAR_SHINY,
  STAR_SWITCH_IN,
  SWITCH_IN_EFFECT_BY_TYPE,
} from '../../config/balance.config';
import { canAwaken, nextAwakenCost } from '../../core/meta';
import { getEvolutionChain } from '../../core/evolution';
import { ALL_POOL_IDS, rarityOf } from '../../data/gachaPools';
import { POKEDEX } from '../../data/pokemon';
import { useMetaStore } from '../metaStore';
import { portraitUrl } from '../pokeAssets';
import { EFFECT_LABEL, PATTERN_LABEL, PATTERN_UPGRADE_TEXT, describePassive } from '../passiveText';
import { RARITY_COLOR, RARITY_LABEL } from '../rarity';
import { StarRow } from './StarRow';
import { TypeChip } from './TypeChip';

/** "Charmeleon Nv16 → Charizard Nv36", or a note when the line has no evolution. */
function evolutionText(id: string): string {
  const chain = getEvolutionChain(id);
  const steps = chain
    .slice(0, -1)
    .map((cid, i) => `${POKEDEX[chain[i + 1]].name} Nv${POKEDEX[cid].evolution?.canonicalLevel}`);
  return steps.join(' → ') || 'no evoluciona';
}

export function PokemonBox() {
  const meta = useMetaStore((s) => s.meta);
  const setSlot = useMetaStore((s) => s.setSlot);
  const awaken = useMetaStore((s) => s.awaken);
  const [selected, setSelected] = useState<string | null>(null);

  const owned = ALL_POOL_IDS.filter((id) => meta.collection[id]);
  const sel = selected && meta.collection[selected] ? selected : null;
  const def = sel ? POKEDEX[sel] : null;
  const entry = sel ? meta.collection[sel] : null;
  const rarity = sel ? rarityOf(sel) : undefined;
  const slotOfSel = sel ? meta.loadout.indexOf(sel) : -1;
  const cost = sel ? nextAwakenCost(meta, sel) : null;

  const onSlot = (i: number): void => {
    const here = meta.loadout[i];
    if (sel && here !== sel) setSlot(i, sel);
    else if (here) setSelected(here);
  };

  const ladder: { star: number; text: string }[] = def
    ? [
        { star: STAR_BENCH_PASSIVE, text: `Pasiva de equipo: ${describePassive(def.benchPassive.stat, def.benchPassive.value)}` },
        { star: STAR_SWITCH_IN, text: `Relevo: ${EFFECT_LABEL[SWITCH_IN_EFFECT_BY_TYPE[def.types[0]]]}` },
        { star: STAR_PATTERN, text: `${PATTERN_LABEL[def.pattern]}: ${PATTERN_UPGRADE_TEXT[def.pattern]}` },
        { star: STAR_SHINY, text: 'Aura Shiny dorada + pasiva ×2' },
      ]
    : [];

  return (
    <div class="flex min-h-0 flex-col gap-3">
      <div>
        <div class="mb-2 text-[9px]">EQUIPO ({meta.loadout.filter(Boolean).length}/6)</div>
        <div class="grid grid-cols-6 gap-1.5 sm:gap-2" data-testid="loadout">
          {meta.loadout.map((id, i) => {
            const e = id ? meta.collection[id] : null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSlot(i)}
                class={`pk-btn relative flex flex-col items-center gap-0.5 px-0.5 py-1.5 text-[8px] ${id && id === sel ? 'pk-btn-active' : ''}`}
                data-testid={`slot-${i}`}
              >
                <span class="absolute left-1 top-0.5 text-[8px]">{i + 1}</span>
                {id ? (
                  <img class="pk-sprite h-10 w-10" src={portraitUrl(id)} alt={POKEDEX[id].name} width={40} height={40} />
                ) : (
                  <span class="pk-ball h-8 w-8 opacity-30" />
                )}
                {e && <StarRow stars={e.stars} size={7} />}
              </button>
            );
          })}
        </div>
        <p class="mt-2 text-[8px] leading-relaxed text-[#585858]">
          {sel ? 'Pulsa una ranura para asignar el Pokémon elegido.' : 'Elige un Pokémon de la caja y pulsa una ranura.'}
        </p>
      </div>

      <div class="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <div class="mb-2 text-[9px]">
            CAJA ({owned.length}/{ALL_POOL_IDS.length})
          </div>
          <div
            class="grid grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-5"
            style={{ maxHeight: '30vh', scrollbarWidth: 'thin' }}
            data-testid="box-grid"
          >
            {owned.map((id) => {
              const e = meta.collection[id];
              const r = rarityOf(id)!;
              const ready = canAwaken(meta, id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(id)}
                  title={POKEDEX[id].name}
                  class={`pk-btn relative flex flex-col items-center gap-0.5 px-0.5 py-1 ${id === sel ? 'pk-btn-active' : ''}`}
                  style={{ borderColor: RARITY_COLOR[r] }}
                  data-testid={`box-${id}`}
                >
                  <img class="pk-sprite h-10 w-10" src={portraitUrl(id)} alt="" width={40} height={40} />
                  <StarRow stars={e.stars} size={7} />
                  {meta.loadout.includes(id) && <span class="absolute right-0.5 top-0 text-[8px] text-[#3a8a3a]">●</span>}
                  {ready && <span class="absolute left-0.5 top-0 text-[8px] text-[#e0a000]">▲</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div class="pk-dark min-h-[140px] p-3 text-[8px] leading-relaxed" data-testid="box-detail">
          {!def || !entry || !rarity ? (
            <span class="text-[#a8c0e0]">Selecciona un Pokémon para ver sus estrellas.</span>
          ) : (
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <img class="pk-sprite h-12 w-12" src={portraitUrl(def.id)} alt="" width={48} height={48} />
                <div class="flex min-w-0 flex-1 flex-col gap-1">
                  <span class="truncate text-[10px]">{def.name.toUpperCase()}</span>
                  <span class="flex flex-wrap items-center gap-1">
                    {def.types.map((t) => <TypeChip key={t} type={t} />)}
                    <span class="pk-chip" style={{ backgroundColor: RARITY_COLOR[rarity] }}>{RARITY_LABEL[rarity]}</span>
                  </span>
                </div>
              </div>
              <div>
                <StarRow stars={entry.stars} size={12} />
                <span class="ml-2 text-[#a8c0e0]">
                  {cost === null ? 'MÁX.' : `${entry.fragments}/${cost} frag.`}
                </span>
              </div>
              <ul class="flex flex-col gap-1">
                {ladder.map((l) => (
                  <li key={l.star} style={{ opacity: entry.stars >= l.star ? 1 : 0.45 }}>
                    <span class="text-[#ffd860]">{l.star}★</span> {l.text}
                  </li>
                ))}
              </ul>
              <div class="text-[#a8c0e0]">
                Evoluciona en la run: {evolutionText(def.id)}
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="pk-btn pk-btn-active flex-1 px-2 py-2 text-[8px] text-[#303030]"
                  disabled={!canAwaken(meta, def.id)}
                  onClick={() => awaken(def.id)}
                  data-testid="awaken"
                >
                  {entry.stars >= MAX_STARS ? 'MÁXIMO' : `DESPERTAR (${AWAKEN_FRAGMENT_COST[entry.stars + 1]})`}
                </button>
                {slotOfSel >= 0 && (
                  <button type="button" class="pk-btn px-2 py-2 text-[8px] text-[#303030]" onClick={() => setSlot(slotOfSel, null)}>
                    QUITAR
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
