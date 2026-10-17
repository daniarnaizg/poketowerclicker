/**
 * PokéBastion — end-of-run summary ("Ficha de Entrenador") with rune payout.
 */

import { runePayout } from '../../config/balance.config';
import { POKEDEX as POKEMON_REGISTRY } from '../../data/pokemon';
import { portraitUrl, portraitUrl as getPortraitUrl } from '../pokeAssets';
import type { RunStats, Team6 } from '../../core/types';
import type { RunRewards } from '../../core/meta';
import { TypeChip as TypeBadge } from './TypeChip';

interface Props {
  runStats: RunStats;
  /** Final team; used to resolve the MVP slot to a Pokémon name. */
  team: Team6;
  /** Seals earned this run (Phase 2); null until settled. */
  rewards?: RunRewards | null;
  onRestart: () => void;
}

function defeatLabel(runStats: RunStats): string {
  const reason =
    runStats.defeatCause === 'bossTimerExpired'
      ? 'Tiempo agotado ante el Boss'
      : 'Equipo debilitado';
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

export function GameOverModal({ runStats, team, rewards, onRestart }: Props) {
  const runes = runePayout(runStats.floorReached);
  const mvpPokemon = runStats.mvpSlotIndex >= 0 ? team[runStats.mvpSlotIndex]?.pokemon : null;
  const mvp = mvpPokemon
    ? (POKEMON_REGISTRY[mvpPokemon.definitionId]?.name ?? `Slot ${runStats.mvpSlotIndex + 1}`)
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
        {(runStats.faintLog?.length ?? 0) > 0 && (
          <div class="mt-4 pk-dark p-3 text-left">
            <h3 class="text-[10px] font-bold text-[#f85888] mb-2 tracking-wider">
              CEMENTERIO DE LA EXPEDICIÓN ({runStats.faintLog!.length})
            </h3>
            <div class="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {runStats.faintLog!.map((entry, idx) => {
                const name = POKEMON_REGISTRY[entry.definitionId]?.name ?? entry.definitionId;
                const causeLabel = entry.cause === 'boss' ? 'Jefe' : 'Fuga';
                return (
                  <div
                    key={idx}
                    class="flex items-center justify-between gap-2 bg-[#142038]/70 border border-[#2a4268] p-1.5 text-[9px]"
                  >
                    <div class="flex items-center gap-2">
                      <img
                        class="pk-sprite h-7 w-7 grayscale"
                        src={getPortraitUrl(entry.definitionId)}
                        alt=""
                        width={28}
                        height={28}
                      />
                      <span class="font-bold text-white">{name}</span>
                      <span class="text-[#a8c0e0]">PISO {entry.floor}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="pk-chip text-[8px] bg-[#2a4268] text-[#e0e0e0]">{causeLabel}</span>
                      {entry.killerType && <TypeBadge type={entry.killerType} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div class="mt-4 text-center text-[11px] leading-loose">
          RUNAS GANADAS
          <div class="pk-num text-4xl text-[#803080]">{runes}</div>
        </div>
        {rewards && (
          <div class="mt-3 pk-dark p-3 text-center text-[10px] leading-loose" data-testid="rewards">
            SELLOS GANADOS
            <div class="pk-num flex items-center justify-center gap-2 text-3xl text-[#ffd860]">
              <span class="pk-ball pk-ball-gold" /> +{rewards.sealsTotal}
            </div>
            <div class="text-[8px] text-[#a8c0e0]">
              Ascensión +{rewards.sealsAscension}
              {rewards.sealsFirstClear > 0 && ` · Primera victoria (piso ${rewards.firstClearFloors.join(', ')}) +${rewards.sealsFirstClear}`}
              {rewards.newBestFloor && ' · ¡NUEVO RÉCORD!'}
            </div>
          </div>
        )}
        <button type="button" onClick={onRestart} class="pk-btn mt-4 w-full bg-[#e03828] px-4 py-3 text-sm text-white enabled:hover:bg-[#f05848]">
          VOLVER A LA BASE
        </button>
      </div>
    </div>
  );
}
