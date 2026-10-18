import { describe, expect, it, vi } from 'vitest';
import { PokemonType } from '../core/types';
import { FX_ATLAS, TYPE_KEYS } from './fxAtlas';
import {
  IMPACT,
  PROJ,
  __setFxImagesForTesting,
  drawImpact,
  drawProjectile,
  fxReady,
  toTypeKey,
} from './fxSprites';

describe('fxSprites runtime & fxAtlas', () => {
  it('fxReady() es true en entornos de test sin DOM', () => {
    expect(fxReady()).toBe(true);
  });

  it('toTypeKey normaliza correctamente nombres en mayúsculas y minúsculas', () => {
    expect(toTypeKey('FIRE')).toBe('fire');
    expect(toTypeKey(PokemonType.Electric)).toBe('electric');
    expect(toTypeKey('water')).toBe('water');
    expect(toTypeKey('UNKNOWN_TYPE')).toBe('unknown_type');
  });

  it('FX_ATLAS define los 18 tipos elementales con coordenadas y dimensiones válidas', () => {
    expect(TYPE_KEYS.length).toBe(18);
    for (const type of TYPE_KEYS) {
      const proj = FX_ATLAS.projectiles.types[type];
      expect(proj).toBeDefined();
      expect(proj.y).toBe(proj.index * 16);

      const impact = FX_ATLAS.impacts.types[type];
      expect(impact).toBeDefined();
      expect(impact.y).toBe(impact.index * 32);
    }
  });

  it('dibuja proyectiles usando ctx.drawImage cuando la hoja está cargada', () => {
    const mockProjImg = { naturalWidth: 64, naturalHeight: 288 } as unknown as HTMLImageElement;
    __setFxImagesForTesting(mockProjImg, null);

    for (const type of TYPE_KEYS) {
      const drawImage = vi.fn();
      const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        drawImage,
      } as unknown as CanvasRenderingContext2D;

      // nowMs = 160 -> frame = Math.floor((160/80)%4) = 2
      drawProjectile(ctx, type, 100, 150, Math.PI / 4, 160);

      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.translate).toHaveBeenCalledWith(100, 150);
      expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 4);
      expect(ctx.restore).toHaveBeenCalled();

      const meta = FX_ATLAS.projectiles.types[type];
      expect(drawImage).toHaveBeenCalledWith(
        mockProjImg,
        2 * PROJ,
        meta.y,
        PROJ,
        PROJ,
        -PROJ / 2,
        -PROJ / 2,
        PROJ,
        PROJ,
      );
    }

    __setFxImagesForTesting(null, null);
  });

  it('dibuja impactos usando ctx.drawImage según el progreso de la animación', () => {
    const mockImpactImg = { naturalWidth: 192, naturalHeight: 576 } as unknown as HTMLImageElement;
    __setFxImagesForTesting(null, mockImpactImg);

    for (const type of TYPE_KEYS) {
      const drawImage = vi.fn();
      const ctx = { drawImage } as unknown as CanvasRenderingContext2D;

      // Progreso 0 -> frame 0
      drawImpact(ctx, type, 60, 80, 0.0);
      const meta = FX_ATLAS.impacts.types[type];
      expect(drawImage).toHaveBeenCalledWith(
        mockImpactImg,
        0,
        meta.y,
        IMPACT,
        IMPACT,
        60 - IMPACT / 2,
        80 - IMPACT / 2,
        IMPACT,
        IMPACT,
      );

      // Progreso 0.95 -> frame 5 (último frame de 6)
      drawImage.mockClear();
      drawImpact(ctx, type, 60, 80, 0.95);
      expect(drawImage).toHaveBeenCalledWith(
        mockImpactImg,
        5 * IMPACT,
        meta.y,
        IMPACT,
        IMPACT,
        60 - IMPACT / 2,
        80 - IMPACT / 2,
        IMPACT,
        IMPACT,
      );
    }

    __setFxImagesForTesting(null, null);
  });

  it('opera de forma segura como no-op si las imágenes no están cargadas', () => {
    __setFxImagesForTesting(null, null);
    const drawImage = vi.fn();
    const ctx = { drawImage } as unknown as CanvasRenderingContext2D;

    expect(() => drawProjectile(ctx, 'fire', 0, 0, 0, 0)).not.toThrow();
    expect(() => drawImpact(ctx, 'fire', 0, 0, 0.5)).not.toThrow();
    expect(drawImage).not.toHaveBeenCalled();
  });
});
