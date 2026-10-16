/**
 * PokéBastion — Hub entre runs (fase MENU): Caja + Santuario y botón de
 * comenzar la expedición con el equipo configurado.
 */

import { useState } from 'preact/hooks';
import { loadoutSize } from '../../core/meta';
import { useMetaStore } from '../metaStore';
import { GachaSanctuary } from './GachaSanctuary';
import { PokemonBox } from './PokemonBox';

type Tab = 'BOX' | 'GACHA';

export function HubScreen({ onStart }: { onStart: () => void }) {
  const meta = useMetaStore((s) => s.meta);
  const [tab, setTab] = useState<Tab>('BOX');
  const size = loadoutSize(meta);

  return (
    <div
      class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-6"
      style={{ backgroundColor: '#2858a8dd' }}
    >
      <div class="pk-window flex w-full max-w-3xl flex-col gap-3 p-4 sm:p-5" data-testid="hub">
        <header class="flex items-center justify-between gap-2 text-[10px]">
          <span class="flex items-center gap-2"><span class="pk-ball" /> BASE DEL ENTRENADOR</span>
          <span class="pk-num text-lg">MEJOR PISO {meta.bestFloor} · SELLOS {meta.seals}</span>
        </header>

        <nav class="grid grid-cols-2 gap-2">
          <button type="button" class={`pk-btn px-2 py-2 text-[10px] ${tab === 'BOX' ? 'pk-btn-active' : ''}`} onClick={() => setTab('BOX')} data-testid="tab-box">
            CAJA Y EQUIPO
          </button>
          <button type="button" class={`pk-btn px-2 py-2 text-[10px] ${tab === 'GACHA' ? 'pk-btn-active' : ''}`} onClick={() => setTab('GACHA')} data-testid="tab-gacha">
            SANTUARIO
          </button>
        </nav>

        {tab === 'BOX' ? <PokemonBox /> : <GachaSanctuary />}

        <button
          type="button"
          class="pk-btn w-full bg-[#e03828] px-4 py-3 text-sm text-white enabled:hover:bg-[#f05848]"
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
