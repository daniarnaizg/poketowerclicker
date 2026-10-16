import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BIOMES, biomeAt } from '../data/biomes';
import { clearBackdropCache, getBackdrop, renderBackground } from './arena';
import { buildBackdrop } from './backdrop';
import { speciesForEnemy } from './sprites';
import { PokemonType } from '../core/types';
import type { Enemy } from '../core/types';
import { handlePortraitError, portraitUrl } from '../ui/pokeAssets';

describe('speciesForEnemy (Block 3A.4)', () => {
  const baseEnemy: Enemy = {
    id: 1,
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    alive: true,
    speed: 30,
    goldValue: 10,
    isBoss: false,
    definitionId: '0019',
    types: [PokemonType.Normal],
  };

  it('returns 4-digit definitionId directly when present', () => {
    expect(speciesForEnemy({ ...baseEnemy, definitionId: '0019' })).toBe('0019');
    expect(speciesForEnemy({ ...baseEnemy, definitionId: '0094', isBoss: true })).toBe('0094');
    expect(speciesForEnemy({ ...baseEnemy, definitionId: '0143' })).toBe('0143');
    expect(speciesForEnemy({ ...baseEnemy, definitionId: '0376' })).toBe('0376');
  });

  it('falls back to WILD_BY_TYPE when definitionId is WILD', () => {
    expect(speciesForEnemy({ ...baseEnemy, definitionId: 'WILD', types: [PokemonType.Fire] })).toBe('0058');
    expect(speciesForEnemy({ ...baseEnemy, definitionId: 'WILD', types: [PokemonType.Water] })).toBe('0054');
    expect(speciesForEnemy({ ...baseEnemy, definitionId: 'WILD', types: [PokemonType.Grass] })).toBe('0043');
  });

  it('falls back to BOSS_BY_TYPE when definitionId is BOSS and isBoss is true', () => {
    expect(speciesForEnemy({ ...baseEnemy, definitionId: 'BOSS', isBoss: true, types: [PokemonType.Fire] })).toBe('0059');
    expect(speciesForEnemy({ ...baseEnemy, definitionId: 'BOSS', isBoss: true, types: [PokemonType.Water] })).toBe('0130');
    expect(speciesForEnemy({ ...baseEnemy, definitionId: 'BOSS', isBoss: true, types: [PokemonType.Ghost] })).toBe('0094');
  });
});

describe('backdrop and biome routing (Block 3A.4)', () => {
  beforeEach(() => {
    clearBackdropCache();
  });

  it('routes floors accurately to biomes', () => {
    expect(biomeAt(1).id).toBe('RUTA_VERDE');
    expect(biomeAt(20).id).toBe('RUTA_VERDE');
    expect(biomeAt(21).id).toBe('CUEVA_UMBRIA');
    expect(biomeAt(50).id).toBe('CUEVA_UMBRIA');
    expect(biomeAt(51).id).toBe('MONTE_IGNEO');
    expect(biomeAt(79).id).toBe('MONTE_IGNEO');
    expect(biomeAt(80).id).toBe('COSTA_RUINAS');
    expect(biomeAt(100).id).toBe('COSTA_RUINAS');
    // Torre del Destino cycling
    expect(biomeAt(101).id).toBe('RUTA_VERDE');
    expect(biomeAt(125).id).toBe('CUEVA_UMBRIA');
  });

  function createMockCanvas() {
    const mockCtx = {
      imageSmoothingEnabled: true,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      beginPath: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      setLineDash: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      quadraticCurveTo: vi.fn(),
    };

    return {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockCtx),
      _ctx: mockCtx,
    };
  }

  it('buildBackdrop renders 384x384 canvas when DOM is available', () => {
    const mockCanvas = createMockCanvas();
    const originalCreateElement = (globalThis as any).document?.createElement;
    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(mockCanvas),
    };

    try {
      const canvas = buildBackdrop(BIOMES.RUTA_VERDE);
      expect(canvas.width).toBe(384);
      expect(canvas.height).toBe(384);
      expect(mockCanvas._ctx.fillRect).toHaveBeenCalled();
      expect(mockCanvas._ctx.setLineDash).toHaveBeenCalledWith([6, 6]);
    } finally {
      if (originalCreateElement) {
        (globalThis as any).document.createElement = originalCreateElement;
      } else {
        delete (globalThis as any).document;
      }
    }
  });

  it('caches backdrop canvas per BiomeId', () => {
    const mockCanvas1 = createMockCanvas();
    const mockCanvas2 = createMockCanvas();
    let callCount = 0;

    (globalThis as any).document = {
      createElement: vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? mockCanvas1 : mockCanvas2;
      }),
    };

    try {
      const b1 = getBackdrop(BIOMES.RUTA_VERDE);
      const b2 = getBackdrop(BIOMES.RUTA_VERDE);
      expect(b1).toBe(b2);
      expect((globalThis as any).document.createElement).toHaveBeenCalledTimes(1);

      const b3 = getBackdrop(BIOMES.CUEVA_UMBRIA);
      expect(b3).not.toBe(b1);
      expect((globalThis as any).document.createElement).toHaveBeenCalledTimes(2);
    } finally {
      delete (globalThis as any).document;
    }
  });

  it('renderBackground draws cached backdrop onto arena context', () => {
    const mockBackdropCanvas = createMockCanvas();
    (globalThis as any).document = {
      createElement: vi.fn().mockReturnValue(mockBackdropCanvas),
    };

    const mockCtx = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    try {
      renderBackground(mockCtx, BIOMES.MONTE_IGNEO);
      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockBackdropCanvas, 0, 0);
    } finally {
      delete (globalThis as any).document;
    }
  });
});

describe('pokeAssets fallback resilience', () => {
  it('generates valid portraitUrl', () => {
    const url = portraitUrl('0004');
    expect(url).toContain('0004');
    expect(url).toContain('Normal.png');
  });

  it('handlePortraitError swaps local and remote URLs on error', () => {
    const fakeImg = {
      src: '/sprites/portrait/0004/Normal.png',
    } as HTMLImageElement;

    handlePortraitError({ currentTarget: fakeImg }, '0004');
    expect(fakeImg.src).toContain('raw.githubusercontent.com');

    handlePortraitError({ currentTarget: fakeImg }, '0004');
    expect(fakeImg.src).toBe('/sprites/portrait/0004/Normal.png');
  });
});
