/**
 * PokéBastion — pestañas genéricas estilo carpeta Pokémon. Para añadir una
 * sección nueva al hub basta con sumar una entrada a la lista `tabs`.
 */

import type { ComponentChildren } from 'preact';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  /** `true` = punto de aviso; número = contador (se oculta si es 0). */
  badge?: boolean | number;
  testId?: string;
}

interface TabsProps<T extends string> {
  tabs: readonly TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  children?: ComponentChildren;
}

export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      class="flex gap-1.5 overflow-x-auto border-b-4 border-[#303030] pl-1 pt-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        const showBadge = t.badge === true || (typeof t.badge === 'number' && t.badge > 0);
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            data-testid={t.testId}
            class={`relative -mb-1 flex-none whitespace-nowrap rounded-t-md border-4 border-b-4 border-[#303030] px-3 py-2 text-[9px] sm:px-5 sm:text-[10px] ${
              on ? 'border-b-[#ffd860] bg-[#ffd860] text-[#303030]' : 'border-b-[#303030] bg-[#d8d8d0] text-[#585858] hover:bg-[#ece8d0]'
            }`}
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            {t.label}
            {showBadge && (
              <span class="absolute -right-1.5 -top-2 min-w-[18px] rounded-full border-2 border-[#303030] bg-[#e03828] px-1 py-0.5 text-center text-[8px] leading-none text-white">
                {typeof t.badge === 'number' ? t.badge : '!'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
