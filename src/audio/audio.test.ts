import { describe, expect, it } from 'vitest';
import { detectAudioEvents, sceneFor } from './events';
import { THEMES, noteToMidi, parseMelody } from './themes';
import type { GameState } from '../core/types';

function slot(i: number, active = false) {
  return { index: i, pokemon: null, isActive: active, hotSwapCooldownSec: 0 };
}

function state(over: Partial<GameState> = {}): GameState {
  return {
    phase: 'PLAYING',
    floor: 1,
    team: [slot(0, true), slot(1), slot(2), slot(3), slot(4), slot(5)],
    teamLevel: 1,
    gold: 0,
    bastionHp: 100,
    bastionMaxHp: 100,
    bastionUpgrades: { UP_HP: 0 },
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
    const next = state({ floor: 2, bastionHp: 80, runStats: { totalKills: 3 } as never });
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
    expect(detectAudioEvents(state(), state({ bastionUpgrades: { UP_HP: 1 } as never })).map((e) => e.type)).toEqual(['buy']);
    expect(detectAudioEvents(state(), state({ teamLevel: 2 })).map((e) => e.type)).toEqual(['levelUp']);
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
