/**
 * PokéBastion — Hub entre runs (fase MENU). Cabecera + pestañas + contenido
 * a pantalla completa y botón de comenzar la expedición siempre visible.
 * Para añadir una sección nueva: ampliar `HubTab`, `tabs` y el `switch` de abajo.
 */

import { useState } from 'preact/hooks';
import { canAwaken, loadoutSize } from '../../core/meta';
import { useMetaStore } from '../metaStore';
import { GachaSanctuary } from './GachaSanctuary';
import { PokemonBox } from './PokemonBox';
import { Tabs } from './Tabs';
import type { TabDef } from './Tabs';

type HubTab = 'BOX' | 'GACHA';

export function HubScreen({ onStart }: { onStart: () => void }) {
  const meta = useMetaStore((s) => s.meta);
  const [tab, setTab] = useState<HubTab>('BOX');
  const size = loadoutSize(meta);
  const ready = Object.keys(meta.collection).filter((id) => canAwaken(meta, id)).length;

  const tabs: TabDef<HubTab>[] = [
    { id: 'BOX', label: 'CAJA Y EQUIPO', badge: ready, testId: 'tab-box' },
    { id: 'GACHA', label: 'SANTUARIO', testId: 'tab-gacha' },
  ];

  return (
    <div class="fixed inset-0 z-40 flex overflow-y-auto p-2 sm:p-4" style={{ backgroundColor: '#2858a8dd' }}>
      <div
        class="pk-window m-auto flex h-[calc(100dvh-1rem)] min-h-[34rem] w-full max-w-5xl flex-col gap-2 p-3 sm:h-[min(calc(100dvh-2rem),52rem)] sm:p-4"
        data-testid="hub"
      >
        <header class="flex items-center justify-between gap-2 text-[9px] sm:text-[10px]">
          <span class="flex items-center gap-2"><span class="pk-ball" /> BASE DEL ENTRENADOR</span>
          <span class="flex items-center gap-3">
            <span class="hidden sm:inline">MEJOR PISO <b class="pk-num text-lg">{meta.bestFloor}</b></span>
            <span class="flex items-center gap-1.5" title="Sellos de reclutamiento">
              <span class="pk-ball pk-ball-gold h-5 w-5" />
              <b class="pk-num text-xl" data-testid="hub-seals">{meta.seals}</b>
            </span>
          </span>
        </header>

        <Tabs tabs={tabs} active={tab} onChange={setTab} />

        <div role="tabpanel" class="min-h-0 flex-1">
          {tab === 'BOX' && <PokemonBox />}
          {tab === 'GACHA' && <GachaSanctuary />}
        </div>

        <button
          type="button"
          class="pk-btn w-full flex-none bg-[#e03828] px-4 py-3 text-sm text-white enabled:hover:bg-[#f05848]"
          disabled={size === 0}
          onClick={onStart}
          data-testid="start-run"
        >
          COMENZAR EXPEDICIÓN ({size}/6)
        </button>
      </div>
    </div>
  );
}
