import { describe, expect, it, vi } from 'vitest';
import { BIOMES } from '../data/biomes';
import { DECOR_ATLAS } from './decorAtlas';
import type { DecorName } from './decorAtlas';
import { getDecorSprite, decorReady, __setSheetImageForTesting } from './decorSprites';
import { hexToRgb, rgbToHex, toRgba, mix, scale, makeRng, hash2, valueNoise } from './pixelArt';

describe('pixelArt — utilidades matemáticas y de color', () => {
  it('hexToRgb y rgbToHex son funciones inversas', () => {
    const rgb = hexToRgb('#ff8000');
    expect(rgb).toEqual([255, 128, 0]);
    expect(rgbToHex(rgb)).toBe('#ff8000');
  });

  it('toRgba convierte formatos hex y rgba() a tupla [r, g, b, a]', () => {
    expect(toRgba('#ff8000')).toEqual([255, 128, 0, 255]);
    expect(toRgba('rgba(0,0,0,0.5)')).toEqual([0, 0, 0, 128]);
  });

  it('mix interpola linealmente dos colores hex', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#ff0000', '#ff0000', 0.75)).toBe('#ff0000');
  });

  it('scale ajusta la luminosidad de un color hex', () => {
    expect(scale('#808080', 2)).toBe('#ffffff');
    expect(scale('#ffffff', 0.5)).toBe('#808080');
  });

  it('makeRng y hash2 son deterministas', () => {
    const rng1 = makeRng(42);
    const rng2 = makeRng(42);
    expect(rng1()).toBe(rng2());
    expect(hash2(10, 20, 123)).toBe(hash2(10, 20, 123));
  });

  it('valueNoise devuelve valores en el rango [0, 1)', () => {
    const v = valueNoise(15.5, 27.3, 16, 99);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});

describe('backdrop — construcción del terreno para todos los biomas', () => {
  it('el fondo se construye para todos los biomas sin lanzar errores', async () => {
    const { buildBackdrop } = await import('./backdrop');
    for (const biome of Object.values(BIOMES)) {
      const ctx = { fillStyle: '', imageSmoothingEnabled: true, fillRect: vi.fn(), drawImage: vi.fn() };
      const canvas = { width: 0, height: 0, getContext: () => ctx };
      (globalThis as any).document = { createElement: () => canvas };
      buildBackdrop(biome);
      expect(ctx.fillRect).toHaveBeenCalled();
      delete (globalThis as any).document;
    }
  });
});

describe('decorAtlas & decorSprites — hojas de sprites editables', () => {
  it('decorReady() reporta estado de carga', () => {
    expect(decorReady()).toBe(true);
  });

  it('el atlas cubre 5 hojas y más de 50 sprites con dimensiones válidas', () => {
    const sheetKeys = Object.keys(DECOR_ATLAS.sheets);
    expect(sheetKeys).toEqual(['ruta_verde', 'cueva_umbria', 'monte_igneo', 'costa_ruinas', 'common']);

    const frameEntries = Object.entries(DECOR_ATLAS.frames);
    expect(frameEntries.length).toBeGreaterThanOrEqual(50);

    for (const [, frame] of frameEntries) {
      expect(frame.w).toBeGreaterThan(0);
      expect(frame.h).toBeGreaterThan(0);
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(DECOR_ATLAS.sheets[frame.sheet]).toBeDefined();
    }
  });

  it('getDecorSprite dibuja correctamente usando drawImage cuando la imagen está cargada', () => {
    const mockImg = { naturalWidth: 138, naturalHeight: 96 } as unknown as HTMLImageElement;
    __setSheetImageForTesting('ruta_verde', mockImg);

    const sprite = getDecorSprite('ruta_verde/tree_a');
    expect(sprite.w).toBe(38);
    expect(sprite.h).toBe(48);

    const drawImage = vi.fn();
    const ctx = {
      drawImage,
      save: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    // Dibujo normal sin flip
    sprite.draw(ctx, 10, 20);
    expect(drawImage).toHaveBeenCalledWith(mockImg, 4, 4, 38, 48, 10, 20, 38, 48);

    // Dibujo con flip horizontal
    drawImage.mockClear();
    sprite.draw(ctx, 10, 20, true);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.translate).toHaveBeenCalledWith(10 + 38, 20);
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    expect(drawImage).toHaveBeenCalledWith(mockImg, 4, 4, 38, 48, 0, 0, 38, 48);
    expect(ctx.restore).toHaveBeenCalled();

    __setSheetImageForTesting('ruta_verde', null);
  });

  it('getDecorSprite opera de forma segura como no-op si la imagen no está cargada', () => {
    __setSheetImageForTesting('common', null);
    const sprite = getDecorSprite('common/platform');
    const drawImage = vi.fn();
    const ctx = { drawImage } as unknown as CanvasRenderingContext2D;

    expect(() => sprite.draw(ctx, 0, 0)).not.toThrow();
    expect(drawImage).not.toHaveBeenCalled();
  });
});
