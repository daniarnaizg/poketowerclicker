/**
 * PokéBastion — Caja Pokémon: colección ilimitada con búsqueda, filtros y
 * orden; equipo de 6 donde solo importa el PRINCIPAL (slot 1, el que sale
 * activo al empezar la run) y ficha con progreso de Despertar.
 *
 * Flujo: toca un Pokémon → ficha → AÑADIR / QUITAR / HACER PRINCIPAL.
 * Con el equipo lleno, "REEMPLAZAR A…" te deja tocar a quién sustituir.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { TEAM_SIZE, canAwaken, findLineConflict, nextAwakenCost } from '../../core/meta';
import { RARITIES } from '../../core/types';
import type { PokemonType } from '../../core/types';
import { rarityOf } from '../../data/gachaPools';
import { POKEDEX } from '../../data/pokemon';
import { EMPTY_FILTERS, SORT_LABEL, activeFilterCount, applyBoxFilters } from '../boxFilters';
import type { BoxFilters, BoxSort } from '../boxFilters';
import { useMetaStore } from '../metaStore';
import { portraitUrl } from '../pokeAssets';
import { RARITY_COLOR, RARITY_LABEL, RARITY_TIER } from '../rarity';
import { TYPE_CHIP, TYPE_LABEL_ES } from '../typeColors';
import { PokemonDetail } from './PokemonDetail';
import { StarRow } from './StarRow';

/** Cuántas tarjetas se pintan de golpe; el resto se carga al hacer scroll. */
const PAGE = 60;

const toggle = <T,>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Chip({ on, onClick, color, children }: { on: boolean; onClick: () => void; color?: string; children: ComponentChildren }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      class="rounded-[3px] border-2 border-[#303030] px-1.5 py-1 text-[8px] leading-none"
      style={{
        fontFamily: "'Press Start 2P', monospace",
        backgroundColor: on ? '#ffd860' : '#f8f8f0',
        color: '#303030',
        boxShadow: color ? `inset 0 -4px 0 ${color}` : undefined,
      }}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class="flex flex-wrap items-center gap-1">
      <span class="mr-1 w-full text-[7px] text-[#585858] sm:w-auto sm:min-w-[5.5rem]">{label}</span>
      {children}
    </div>
  );
}

const inputStyle = { fontFamily: "'Press Start 2P', monospace" };

export function PokemonBox() {
  const meta = useMetaStore((s) => s.meta);
  const setTeam = useMetaStore((s) => s.setTeam);

  const [filters, setFilters] = useState<BoxFilters>(EMPTY_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const allIds = Object.keys(meta.collection);
  const team = meta.loadout.filter((x): x is string => !!x);
  const teamFull = team.length >= TEAM_SIZE;
  const readyCount = allIds.filter((id) => canAwaken(meta, id)).length;

  const filtered = applyBoxFilters(allIds, meta, filters);
  const visible = filtered.slice(0, limit);
  const nActive = activeFilterCount(filters);

  // Opciones de filtro derivadas de lo que realmente hay en la caja.
  const gens = Array.from(new Set(allIds.map((id) => POKEDEX[id]?.generation).filter((g): g is number => !!g))).sort((a, b) => a - b);
  const types = Array.from(new Set(allIds.flatMap((id) => POKEDEX[id]?.types ?? []))) as PokemonType[];

  const sel = selected && meta.collection[selected] ? selected : (team[0] ?? null);
  const replacingDef = replacing ? POKEDEX[replacing] : null;

  const update = (patch: Partial<BoxFilters>): void => {
    setFilters((f) => ({ ...f, ...patch }));
    setLimit(PAGE);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  // Carga progresiva al llegar al final de la rejilla.
  useEffect(() => {
    const root = scrollRef.current;
    const node = sentinelRef.current;
    if (!root || !node || typeof IntersectionObserver === 'undefined') return;
    if (limit >= filtered.length) return;
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE);
    }, { root, rootMargin: '120px' });
    io.observe(node);
    return () => io.disconnect();
  }, [limit, filtered.length]);

  const pick = (id: string): void => {
    setSelected(id);
    setSheetOpen(true);
    setReplacing(null);
    setNotice(null);
  };

  const lineNotice = (other: string): string =>
    `Ya llevas a ${POKEDEX[other].name}: solo un Pokémon por línea evolutiva.`;

  const add = (id: string): void => {
    const clash = findLineConflict(team, id);
    if (clash) return setNotice(lineNotice(clash));
    setNotice(null);
    setTeam([...team, id]);
  };
  const remove = (id: string): void => {
    setNotice(null);
    setTeam(team.filter((x) => x !== id));
  };
  const makeMain = (id: string): void => setTeam([id, ...team.filter((x) => x !== id)]);
  const replaceWith = (target: string): void => {
    if (!replacing) return;
    const rest = team.filter((x) => x !== target);
    const clash = findLineConflict(rest, replacing);
    if (clash) return setNotice(lineNotice(clash));
    setNotice(null);
    setTeam(team.map((x) => (x === target ? replacing : x)));
    setReplacing(null);
  };

  const onSlot = (i: number): void => {
    const id = meta.loadout[i];
    if (!id) return;
    if (replacing) replaceWith(id);
    else pick(id);
  };

  const detail = sel ? (
    <PokemonDetail
      id={sel}
      inTeam={team.includes(sel)}
      isMain={team[0] === sel}
      teamFull={teamFull}
      notice={notice}
      onAdd={() => add(sel)}
      onRemove={() => remove(sel)}
      onMakeMain={() => makeMain(sel)}
      onReplace={() => {
        setReplacing(sel);
        setSheetOpen(false);
        setNotice(null);
      }}
      onClose={() => setSheetOpen(false)}
    />
  ) : (
    <p class="p-1 text-[9px] leading-relaxed text-[#a8c0e0]">Selecciona un Pokémon para ver su ficha.</p>
  );

  return (
    <div class="flex h-full min-h-0 flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-4">
      <div class="flex min-h-0 flex-1 flex-col gap-2">
        {/* ---- Equipo ---- */}
        <section>
          <div class="mb-1.5 flex items-center justify-between text-[9px]">
            <span>EQUIPO ({team.length}/{TEAM_SIZE})</span>
            <span class="text-[7px] text-[#585858]">SOLO IMPORTA EL PRINCIPAL</span>
          </div>
          <div class="grid grid-cols-[2fr_repeat(5,minmax(0,1fr))] gap-1.5" data-testid="loadout">
            {meta.loadout.map((id, i) => {
              const main = i === 0;
              const e = id ? meta.collection[id] : null;
              const swapTarget = !!replacing && !!id;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSlot(i)}
                  disabled={!id}
                  class={`pk-btn relative flex flex-col items-center justify-center gap-0.5 !min-h-0 px-0.5 py-1.5 text-[7px] ${id && id === sel && !replacing ? 'pk-btn-active' : ''} ${swapTarget ? 'pk-ready' : ''}`}
                  style={main ? { borderColor: '#c08800', backgroundColor: id === sel && !replacing ? '#ffd860' : '#fff4c8' } : undefined}
                  data-testid={`slot-${i}`}
                  aria-label={id ? POKEDEX[id].name : 'Ranura vacía'}
                >
                  {main && <span class="text-[7px] text-[#a06800]">★ PRINCIPAL</span>}
                  {id ? (
                    <img
                      class={`pk-sprite ${main ? 'h-12 w-12' : 'h-9 w-9 sm:h-10 sm:w-10'}`}
                      src={portraitUrl(id)}
                      alt=""
                      width={main ? 48 : 40}
                      height={main ? 48 : 40}
                    />
                  ) : (
                    <span class={`pk-ball opacity-25 ${main ? 'h-8 w-8' : 'h-6 w-6'}`} />
                  )}
                  {e && <StarRow stars={e.stars} size={7} />}
                  {swapTarget && <span class="text-[7px] text-[#c03020]">CAMBIAR</span>}
                  {id && canAwaken(meta, id) && !replacing && <span class="pk-ready absolute right-0.5 top-0 text-[9px] text-[#e0a000]">▲</span>}
                </button>
              );
            })}
          </div>
          {(replacingDef || (notice && !sheetOpen)) && (
            <p class="mt-1.5 flex items-center justify-between gap-2 text-[8px] leading-relaxed">
              {replacingDef ? (
                <>
                  <span>Toca a quién sustituir por <b>{replacingDef.name.toUpperCase()}</b>.</span>
                  <button type="button" class="pk-btn !min-h-0 flex-none px-2 py-1 text-[8px]" onClick={() => setReplacing(null)}>CANCELAR</button>
                </>
              ) : (
                <span class="text-[#803030]">{notice}</span>
              )}
            </p>
          )}
        </section>

        {/* ---- Búsqueda, orden y filtros ---- */}
        <section class="flex flex-col gap-1.5">
          <div class="flex gap-1.5">
            <input
              type="search"
              value={filters.query}
              onInput={(e) => update({ query: (e.currentTarget as HTMLInputElement).value })}
              placeholder="BUSCAR NOMBRE O Nº"
              aria-label="Buscar Pokémon"
              class="min-w-0 flex-1 rounded-[4px] border-4 border-[#303030] bg-[#f8f8f0] px-2 py-1.5 text-[9px] placeholder:text-[#989890]"
              style={inputStyle}
              data-testid="box-search"
            />
            <select
              value={filters.sort}
              onChange={(e) => update({ sort: (e.currentTarget as HTMLSelectElement).value as BoxSort })}
              aria-label="Ordenar por"
              class="w-[7.5rem] flex-none rounded-[4px] border-4 border-[#303030] bg-[#f8f8f0] px-1 py-1.5 text-[8px] sm:w-36"
              style={inputStyle}
              data-testid="box-sort"
            >
              {(Object.keys(SORT_LABEL) as BoxSort[]).map((s) => (
                <option key={s} value={s}>{SORT_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <Chip on={filters.ready} onClick={() => update({ ready: !filters.ready })}>
              ▲ LISTOS PARA DESPERTAR ({readyCount})
            </Chip>
            <Chip on={panelOpen || nActive - (filters.ready ? 1 : 0) > 0} onClick={() => setPanelOpen((o) => !o)}>
              FILTROS{nActive - (filters.ready ? 1 : 0) > 0 ? ` (${nActive - (filters.ready ? 1 : 0)})` : ''} {panelOpen ? '▴' : '▾'}
            </Chip>
            {nActive > 0 && (
              <button
                type="button"
                class="text-[8px] text-[#c03020] underline"
                style={inputStyle}
                onClick={() => update({ ...EMPTY_FILTERS, sort: filters.sort })}
              >
                LIMPIAR
              </button>
            )}
            <span class="ml-auto text-[8px] text-[#585858]" data-testid="box-count">
              {filtered.length === allIds.length ? `${allIds.length} EN LA CAJA` : `${filtered.length} DE ${allIds.length}`}
            </span>
          </div>

          {panelOpen && (
            <div class="flex max-h-44 flex-col gap-2 overflow-y-auto rounded-[4px] border-4 border-[#303030] bg-[#ece8d8] p-2" style={{ scrollbarWidth: 'thin' }} data-testid="box-filters">
              <FilterGroup label="ESTRELLAS">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Chip key={n} on={filters.stars.includes(n)} onClick={() => update({ stars: toggle(filters.stars, n) })}>{n}★</Chip>
                ))}
              </FilterGroup>
              <FilterGroup label="RANGO">
                {RARITIES.map((r) => (
                  <Chip key={r} on={filters.rarities.includes(r)} color={RARITY_COLOR[r]} onClick={() => update({ rarities: toggle(filters.rarities, r) })}>
                    {'★'.repeat(RARITY_TIER[r])} {RARITY_LABEL[r]}
                  </Chip>
                ))}
              </FilterGroup>
              {gens.length > 1 && (
                <FilterGroup label="GENERACIÓN">
                  {gens.map((g) => (
                    <Chip key={g} on={filters.gens.includes(g)} onClick={() => update({ gens: toggle(filters.gens, g) })}>GEN {g}</Chip>
                  ))}
                </FilterGroup>
              )}
              <FilterGroup label="TIPO">
                {types.map((t) => (
                  <Chip key={t} on={filters.types.includes(t)} color={TYPE_CHIP[t]} onClick={() => update({ types: toggle(filters.types, t) })}>
                    {TYPE_LABEL_ES[t]}
                  </Chip>
                ))}
              </FilterGroup>
              <FilterGroup label="OTROS">
                <Chip on={filters.shiny} onClick={() => update({ shiny: !filters.shiny })}>✦ SHINY</Chip>
                <Chip on={filters.inTeam} onClick={() => update({ inTeam: !filters.inTeam })}>● EN EQUIPO</Chip>
              </FilterGroup>
            </div>
          )}
        </section>

        {/* ---- Rejilla ---- */}
        <div ref={scrollRef} class="min-h-[8rem] flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }} data-testid="box-grid">
          {allIds.length === 0 && <p class="p-2 text-[9px] text-[#585858]">Tu caja está vacía.</p>}
          {allIds.length > 0 && filtered.length === 0 && (
            <p class="p-2 text-[9px] leading-relaxed text-[#585858]">Ningún Pokémon coincide con los filtros.</p>
          )}
          <div class="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5 pb-1.5">
            {visible.map((id) => {
              const e = meta.collection[id];
              const r = rarityOf(id);
              const ready = canAwaken(meta, id);
              const cost = nextAwakenCost(meta, id);
              const inTeam = meta.loadout.includes(id);
              const pct = cost ? Math.min(100, (e.fragments / cost) * 100) : 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => pick(id)}
                  title={`${POKEDEX[id].name}${cost ? ` · ${e.fragments}/${cost} frag.` : ' · máx.'}`}
                  class={`pk-btn relative flex flex-col items-center gap-0.5 !min-h-0 px-0.5 pb-1 pt-2 ${id === sel ? 'pk-btn-active' : ''}`}
                  style={r ? { borderColor: RARITY_COLOR[r] } : undefined}
                  data-testid={`box-${id}`}
                >
                  <img class="pk-sprite h-10 w-10" src={portraitUrl(id)} alt={POKEDEX[id].name} width={40} height={40} loading="lazy" />
                  <StarRow stars={e.stars} size={7} />
                  <span class={`block h-2 w-[86%] border border-[#303030] bg-[#d8d8d0] ${cost ? '' : 'invisible'}`}>
                    <span class="block h-full" style={{ width: `${pct}%`, backgroundColor: ready ? '#e0a000' : '#58a8f0' }} />
                  </span>
                  {inTeam && <span class="absolute right-0.5 top-0 text-[8px] text-[#3a8a3a]">●</span>}
                  {ready && <span class="pk-ready absolute left-0.5 top-0 text-[9px] text-[#e0a000]">▲</span>}
                  {e.shinyOwned && <span class="absolute bottom-3 right-0.5 text-[8px] text-[#c08800]">✦</span>}
                </button>
              );
            })}
          </div>
          {limit < filtered.length && <div ref={sentinelRef} class="h-4" />}
        </div>

        <p class="flex-none text-[7px] leading-relaxed text-[#585858]">
          ● EN EQUIPO · ▲ LISTO PARA DESPERTAR · LA BARRA MUESTRA LOS FRAGMENTOS HACIA LA SIGUIENTE ★
        </p>
      </div>

      {/* ---- Ficha: columna fija en pantallas anchas, hoja inferior en móvil ---- */}
      <aside
        class={`min-h-0 ${
          sheetOpen && sel
            ? 'fixed inset-0 z-50 flex items-end bg-black/60 p-2 lg:static lg:z-auto lg:block lg:bg-transparent lg:p-0'
            : 'hidden lg:block'
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSheetOpen(false);
        }}
      >
        <div class="pk-dark max-h-[85dvh] w-full overflow-y-auto p-3 lg:h-full lg:max-h-none" style={{ scrollbarWidth: 'thin' }}>
          {detail}
        </div>
      </aside>
    </div>
  );
}
