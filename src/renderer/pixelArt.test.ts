import { describe, expect, it, vi } from 'vitest';
import { BIOMES } from '../data/biomes';
import * as Decor from './decor';
import { PixelBuffer, blit, mix } from './pixelArt';

describe('PixelBuffer', () => {
  it('dibuja un disco y le añade contorno de 1 px', () => {
    const b = new PixelBuffer(16, 16);
    b.disc(8, 8, 4, '#ff0000');
    const before = b.count();
    b.outline('#000000');
    expect(b.count()).toBeGreaterThan(before);
    expect(b.get(8, 8)).toBe('#ff0000');
    expect(b.get(0, 0)).toBeNull();
  });

  it('blit agrupa tramos del mismo color en un único fillRect', () => {
    const b = new PixelBuffer(6, 1);
    b.rect(0, 0, 6, 1, '#00ff00');
    const ctx = { fillStyle: '', fillRect: vi.fn() };
    blit(ctx, b, 10, 20);
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 6, 1);
  });

  it('mix interpola colores', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('sprites decorativos', () => {
  const sprites: Record<string, PixelBuffer> = {
    tree: Decor.buildTree(),
    pine: Decor.buildPine(),
    bush: Decor.buildBush(true),
    flowers: Decor.buildFlowerPatch(),
    stalagmite: Decor.buildStalagmite(),
    crystals: Decor.buildCrystalCluster(),
    lava: Decor.buildLavaPool(),
    deadTree: Decor.buildDeadTree(),
    palm: Decor.buildPalm(),
    column: Decor.buildColumn(true),
    tidePool: Decor.buildTidePool(),
  };

  it.each(Object.keys(sprites))('%s tiene píxeles suficientes', (name) => {
    expect(sprites[name].count()).toBeGreaterThan(20);
  });

  it('es determinista', () => {
    expect(Decor.buildTree(3).px).toEqual(Decor.buildTree(3).px);
  });

  it('el fondo se construye para todos los biomas sin lanzar', () => {
    for (const biome of Object.values(BIOMES)) {
      const ctx = { fillStyle: '', imageSmoothingEnabled: true, fillRect: vi.fn() };
      const canvas = { width: 0, height: 0, getContext: () => ctx };
      (globalThis as any).document = { createElement: () => canvas };
      return import('./backdrop').then(({ buildBackdrop }) => {
        buildBackdrop(biome);
        expect(ctx.fillRect).toHaveBeenCalled();
        delete (globalThis as any).document;
      });
    }
  });
});
