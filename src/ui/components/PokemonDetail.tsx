/**
 * PokéBastion — ficha de un Pokémon de la Caja: estrellas, progreso de
 * fragmentos, qué desbloquea cada estrella y acciones de equipo.
 */

import {
  MAX_STARS,
  STAR_AURA_APEX,
  STAR_BENCH_PASSIVE,
  STAR_PATTERN,
  STAR_SWITCH_IN,
  SWITCH_IN_EFFECT_BY_TYPE,
} from '../../config/balance.config';
import { canAwaken, nextAwakenCost } from '../../core/meta';
import { rarityOf } from '../../data/gachaPools';
import { POKEDEX } from '../../data/pokemon';
import { useMetaStore } from '../metaStore';
import { portraitUrl } from '../pokeAssets';
import { EFFECT_LABEL, PATTERN_LABEL, PATTERN_UPGRADE_TEXT, describePassive } from '../passiveText';
import { RARITY_COLOR, RARITY_LABEL } from '../rarity';
import { StarRow } from './StarRow';
import { TypeChip } from './TypeChip';

interface Props {
  id: string;
  inTeam: boolean;
  isMain: boolean;
  teamFull: boolean;
  /** Mensaje de aviso (p. ej. conflicto de línea evolutiva). */
  notice: string | null;
  onAdd: () => void;
  onRemove: () => void;
  onMakeMain: () => void;
  /** Equipo lleno: entra en modo "elige a quién sustituir". */
  onReplace: () => void;
  onClose: () => void;
}

export function PokemonDetail({ id, inTeam, isMain, teamFull, notice, onAdd, onRemove, onMakeMain, onReplace, onClose }: Props) {
  const meta = useMetaStore((s) => s.meta);
  const awaken = useMetaStore((s) => s.awaken);
  const def = POKEDEX[id];
  const entry = meta.collection[id];
  if (!def || !entry) return null;

  const rarity = rarityOf(id);
  const cost = nextAwakenCost(meta, id);
  const ready = canAwaken(meta, id);
  const maxed = entry.stars >= MAX_STARS;
  const pct = cost ? Math.min(100, (entry.fragments / cost) * 100) : 100;
  const nextStar = entry.stars + 1;

  const ladder: { star: number; text: string }[] = [
    { star: STAR_BENCH_PASSIVE, text: `Pasiva de equipo: ${describePassive(def.benchPassive.stat, def.benchPassive.value)}` },
    { star: STAR_SWITCH_IN, text: `Relevo: ${EFFECT_LABEL[SWITCH_IN_EFFECT_BY_TYPE[def.types[0]]]}` },
    { star: STAR_PATTERN, text: `${PATTERN_LABEL[def.pattern]}: ${PATTERN_UPGRADE_TEXT[def.pattern]}` },
    { star: STAR_AURA_APEX, text: 'Aura Apex dorada + pasiva ×2' },
  ];

  return (
    <div class="flex min-h-0 flex-col gap-3 text-[8px] leading-relaxed" data-testid="box-detail">
      <div class="flex items-center gap-3">
        <img class="pk-sprite h-14 w-14 flex-none" src={portraitUrl(def.id)} alt="" width={56} height={56} />
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <span class="truncate text-[11px]">{def.name.toUpperCase()}</span>
          <span class="flex flex-wrap items-center gap-1">
            {def.types.map((t) => <TypeChip key={t} type={t} />)}
            {rarity && <span class="pk-chip" style={{ backgroundColor: RARITY_COLOR[rarity] }}>{RARITY_LABEL[rarity]}</span>}
          </span>
          <span class="text-[#a8c0e0]">Nº{Number(def.id)} · GEN {def.generation}</span>
        </div>
        <button type="button" class="pk-btn !min-h-0 flex-none px-2 py-1 text-[10px] text-[#303030] lg:hidden" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <StarRow stars={entry.stars} size={14} />
          <span class={ready ? 'text-[#ffd860]' : 'text-[#a8c0e0]'}>
            {maxed ? 'NIVEL MÁXIMO' : `${entry.fragments}/${cost} FRAG.`}
          </span>
        </div>
        {!maxed && (
          <span class="block h-3 w-full border-2 border-[#f8f8f0] bg-[#585858]">
            <span class="block h-full" style={{ width: `${pct}%`, backgroundColor: ready ? '#ffd860' : '#58a8f0' }} />
          </span>
        )}
        <button
          type="button"
          class={`pk-btn px-2 py-2 text-[9px] text-[#303030] ${ready ? 'pk-btn-active pk-ready' : ''}`}
          disabled={!ready}
          onClick={() => awaken(def.id)}
          data-testid="awaken"
        >
          {maxed
            ? 'MÁXIMO'
            : ready
              ? `¡DESPERTAR A ${nextStar}★!`
              : `FALTAN ${(cost ?? 0) - entry.fragments} FRAG. PARA ${nextStar}★`}
        </button>
        {!maxed && !ready && (
          <span class="text-[#a8c0e0]">Las invocaciones repetidas dan fragmentos.</span>
        )}
      </div>

      <ul class="flex flex-col gap-1.5">
        {ladder.map((l) => {
          const unlocked = entry.stars >= l.star;
          const isNext = !unlocked && l.star === nextStar;
          return (
            <li
              key={l.star}
              class={`flex gap-2 border-l-4 py-0.5 pl-2 ${unlocked ? 'border-[#58c858]' : isNext ? 'border-[#ffd860] bg-[#404040]' : 'border-[#585858] opacity-50'}`}
            >
              <span class={`flex-none ${unlocked ? 'text-[#58c858]' : 'text-[#ffd860]'}`}>{l.star}★</span>
              <span class="min-w-0 flex-1">
                {l.text}
                {isNext && <b class="ml-1 text-[#ffd860]">{ready ? '← ¡LISTO!' : '← SIGUIENTE'}</b>}
              </span>
            </li>
          );
        })}
      </ul>

      <div class="mt-auto flex flex-col gap-2">
        {notice && <p class="text-[#ff9890]">{notice}</p>}
        {inTeam ? (
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="pk-btn px-2 py-2 text-[8px] text-[#303030]"
              disabled={isMain}
              onClick={onMakeMain}
              data-testid="make-main"
            >
              {isMain ? '★ PRINCIPAL' : 'HACER PRINCIPAL'}
            </button>
            <button type="button" class="pk-btn px-2 py-2 text-[8px] text-[#303030]" onClick={onRemove} data-testid="remove-from-team">
              QUITAR
            </button>
          </div>
        ) : (
          <button
            type="button"
            class="pk-btn pk-btn-active px-2 py-2 text-[9px] text-[#303030]"
            onClick={teamFull ? onReplace : onAdd}
            data-testid="add-to-team"
          >
            {teamFull ? 'REEMPLAZAR A…' : 'AÑADIR AL EQUIPO'}
          </button>
        )}
      </div>
    </div>
  );
}
