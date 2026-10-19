import { describe, expect, it } from 'vitest';
import { detectAudioEvents, sceneFor, SILENT_EVENTS } from './events';
import { THEMES, noteToMidi, parseMelody } from './themes';
import type { GameState } from '../core/types';

function slot(i: number, active = false, hp = 100, maxHp = 100) {
  return {
    index: i,
    pokemon: { definitionId: '0004', hp, maxHp, alive: hp > 0 },
    isActive: active,
    hotSwapCooldownSec: 0,
  };
}

function state(over: Partial<GameState> = {}): GameState {
  return {
    phase: 'PLAYING',
    floor: 1,
    team: [slot(0, true), slot(1), slot(2), slot(3), slot(4), slot(5)],
    teamLevel: 1,
    gold: 0,
    bastionUpgrades: {
      UP_ARROW: 0,
      UP_SPD: 0,
      UP_MULTI: 0,
      UP_AUTOCLICK: 0,
      UP_CRIT: 0,
      UP_CDMG: 0,
      UP_GOLD: 0,
    },
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    effects: [],
    runStats: { totalKills: 0 },
    ...over,
  } as unknown as GameState;
}

describe('detectAudioEvents', () => {
  it('no emite nada sin estado previo', () => {
    expect(detectAudioEvents(null, state())).toEqual([]);
  });

  it('detecta bajas, daño al bastión y subida de piso', () => {
    const prev = state();
    const next = state({
      floor: 2,
      team: [slot(0, true, 80), slot(1), slot(2), slot(3), slot(4), slot(5)],
      runStats: { totalKills: 3 } as never,
    });
    const types = detectAudioEvents(prev, next).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['kill', 'hurt', 'floor']));
  });

  it('los RING (clics) no cuentan como definitiva, los BEAM/NOVA sí', () => {
    const ring = { id: 1, kind: 'RING', x: 0, y: 0, type: 'Fire', age: 0, maxAge: 1 };
    const nova = { id: 2, kind: 'NOVA', x: 0, y: 0, type: 'Fire', age: 0, maxAge: 1 };
    expect(detectAudioEvents(state(), state({ effects: [ring] as never })).map((e) => e.type)).not.toContain('ultimate');
    expect(detectAudioEvents(state(), state({ effects: [nova] as never })).map((e) => e.type)).toContain('ultimate');
  });

  it('detecta cambio de Pokémon activo', () => {
    const next = state({ team: [slot(0), slot(1, true), slot(2), slot(3), slot(4), slot(5)] as never });
    expect(detectAudioEvents(state(), next).map((e) => e.type)).toContain('swap');
  });

  it('transiciones de fase', () => {
    expect(detectAudioEvents(state({ phase: 'MENU' }), state()).map((e) => e.type)).toEqual(['start']);
    expect(detectAudioEvents(state(), state({ phase: 'GAME_OVER' })).map((e) => e.type)).toEqual(['gameOver']);
  });

  it('compra de mejora vs. nivel de equipo', () => {
    expect(detectAudioEvents(state(), state({ bastionUpgrades: { UP_ARROW: 1 } as never })).map((e) => e.type)).toEqual(['buy']);
    expect(detectAudioEvents(state(), state({ teamLevel: 2 })).map((e) => e.type)).toEqual(['levelUp']);
  });

  it('emite hit cuando totalDamageDealt sube y no cuando no cambia', () => {
    const s0 = state({ runStats: { totalKills: 0, totalDamageDealt: 100 } as never });
    const s1 = state({ runStats: { totalKills: 0, totalDamageDealt: 150 } as never });
    const s2 = state({ runStats: { totalKills: 0, totalDamageDealt: 150 } as never });

    expect(detectAudioEvents(s0, s1).map((e) => e.type)).toContain('hit');
    expect(detectAudioEvents(s1, s2).map((e) => e.type)).not.toContain('hit');
    expect(detectAudioEvents(state(), state()).map((e) => e.type)).not.toContain('hit');
    expect(detectAudioEvents(state(), s0).map((e) => e.type)).toContain('hit');
  });
});

describe('SILENT_EVENTS', () => {
  it('contiene kill y floor y no contiene hurt ni hit', () => {
    expect(SILENT_EVENTS.has('kill')).toBe(true);
    expect(SILENT_EVENTS.has('floor')).toBe(true);
    expect(SILENT_EVENTS.has('hurt')).toBe(false);
    expect(SILENT_EVENTS.has('hit')).toBe(false);
  });
});

describe('sceneFor', () => {
  it('elige música por fase, bioma y jefe', () => {
    expect(sceneFor(state({ phase: 'MENU' }))).toBe('menu');
    expect(sceneFor(state({ floor: 5 }))).toBe('route');
    expect(sceneFor(state({ floor: 30 }))).toBe('cave');
    expect(sceneFor(state({ floor: 60 }))).toBe('volcano');
    expect(sceneFor(state({ floor: 90 }))).toBe('coast');
    expect(sceneFor(state({ enemies: [{ alive: true, isBoss: true }] as never }))).toBe('boss');
    expect(sceneFor(state({ phase: 'GAME_OVER' }))).toBeNull();
  });
});

describe('temas musicales', () => {
  it('noteToMidi', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C#5')).toBe(73);
    expect(noteToMidi('Bb3')).toBe(58);
  });

  it.each(Object.keys(THEMES))('%s: un acorde por compás o el bucle de acordes divide la melodía', (id) => {
    const t = THEMES[id as keyof typeof THEMES];
    expect(parseMelody(t.melody).length).toBeGreaterThan(8);
    expect(t.melody.length % t.chords.length).toBe(0);
  });
});

describe('controles independientes de audio (BGM y SFX)', () => {
  it('permite alternar BGM y SFX de forma independiente', async () => {
    const { audio } = await import('./index');

    const initialMusic = audio.isMusicMuted();
    const initialSfx = audio.isSfxMuted();

    expect(audio.toggleMusic()).toBe(!initialMusic);
    expect(audio.isMusicMuted()).toBe(!initialMusic);
    expect(audio.isSfxMuted()).toBe(initialSfx); // SFX no cambia al tocar BGM

    expect(audio.toggleSfx()).toBe(!initialSfx);
    expect(audio.isSfxMuted()).toBe(!initialSfx);
    expect(audio.isMusicMuted()).toBe(!initialMusic); // BGM no cambia al tocar SFX

    // Restaurar
    audio.setMusicMuted(initialMusic);
    audio.setSfxMuted(initialSfx);
  });
});
