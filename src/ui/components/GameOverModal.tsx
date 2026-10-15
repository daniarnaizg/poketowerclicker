/**
 * PokéBastion — end-of-run summary ("Ficha de Entrenador") with rune payout.
 */

import { runePayout } from '../../config/balance.config';
import { POKEDEX } from '../../data/pokemon';
import { portraitUrl } from '../pokeAssets';
import type { RunStats, Team6 } from '../../core/types';

interface Props {
  runStats: RunStats;
  /** Final team; used to resolve the MVP slot to a Pokémon name. */
  team: Team6;
  onRestart: () => void;
}

function defeatLabel(runStats: RunStats): string {
  const reason =
    runStats.defeatCause === 'bossTimerExpired'
      ? 'Tiempo agotado'
      : runStats.defeatCause === 'bastionDestroyed'
        ? 'Bastión destruido'
        : '—';
  return runStats.defeatEnemyType ? `${reason} (${runStats.defeatEnemyType})` : reason;
}

function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div class="pk-dark p-3">
      <dt class="text-[9px] text-[#a8c0e0]">{label}</dt>
      <dd class="mt-2 text-sm">{value}</dd>
    </div>
  );
}

export function GameOverModal({ runStats, team, onRestart }: Props) {
  const runes = runePayout(runStats.floorReached);
  const mvpPokemon = runStats.mvpSlotIndex >= 0 ? team[runStats.mvpSlotIndex]?.pokemon : null;
  const mvp = mvpPokemon
    ? (POKEDEX[mvpPokemon.definitionId]?.name ?? `Slot ${runStats.mvpSlotIndex + 1}`)
    : '—';
  const cause = defeatLabel(runStats);
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-[#181830]/90 p-4">
      <div class="pk-window w-full max-w-lg p-6">
        <h2 class="flex items-center justify-center gap-3 text-sm leading-relaxed sm:text-base">
          <span class="pk-ball" /> FICHA DE ENTRENADOR <span class="pk-ball" />
        </h2>
        <dl class="mt-5 grid grid-cols-2 gap-3">
          <Stat label="PISO" value={runStats.floorReached} />
          <Stat label="BAJAS" value={runStats.totalKills} />
          <Stat label="ORO GANADO" value={runStats.totalGoldEarned} />
          <Stat label="DURACIÓN" value={formatDuration(runStats.durationSec)} />
          <div class="col-span-2">
            <Stat label="CAUSA" value={cause} />
          </div>
          <div class="col-span-2 flex items-center gap-3">
            {mvpPokemon && (
              <img
                class="pk-sprite h-12 w-12"
                src={portraitUrl(mvpPokemon.definitionId)}
                alt=""
                width={48}
                height={48}
              />
            )}
            <div class="flex-1">
              <Stat label="★ MVP" value={mvp} />
            </div>
          </div>
        </dl>
        <div class="mt-4 text-center text-[11px] leading-loose">
          RUNAS GANADAS
          <div class="pk-num text-4xl text-[#803080]">{runes}</div>
        </div>
        <button type="button" onClick={onRestart} class="pk-btn mt-4 w-full bg-[#e03828] px-4 py-3 text-sm text-white enabled:hover:bg-[#f05848]">
          NUEVA PARTIDA
        </button>
      </div>
    </div>
  );
}
