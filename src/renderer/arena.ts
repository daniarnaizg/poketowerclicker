// src/renderer/arena.ts — Canvas 2D arena renderer, 144×144 logical px
import { BALANCE } from '../config/balance.config';
import { getPokemonDef } from '../core/evolution';
import type { GameEngine } from '../core/engine';

const TYPE_COLORS: Record<string, string> = {
  NORMAL: '#a8a878', FIRE: '#f08030', WATER: '#6890f0', GRASS: '#78c850',
  ELECTRIC: '#f8d030', PSYCHIC: '#f85888', GHOST: '#705898', ROCK: '#b8a038',
  GROUND: '#e0c068', POISON: '#a040a0', FIGHTING: '#c03028', FLYING: '#a890f0',
  DRAGON: '#7038f8', STEEL: '#b8b8d0', DARK: '#705848', BUG: '#a8b820',
  ICE: '#98d8d8', FAIRY: '#ee99ac',
};

// Simple color lookup for enemy "pokemon"
const ENEMY_COLORS: Record<string, string> = {
  enemy_pidgey: '#a89070',
  enemy_rattata: '#a06040',
  enemy_caterpie: '#60a820',
  enemy_weedle: '#a08020',
  enemy_zubat: '#8060b0',
  enemy_geodude: '#a09060',
  enemy_gastly: '#6850a0',
  enemy_magikarp: '#f08030',
  enemy_miniboss: '#d04040',
  enemy_boss: '#ff2020',
};

export class ArenaRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: GameEngine;
  private animFrame = 0;

  constructor(canvas: HTMLCanvasElement, engine: GameEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.engine = engine;

    // Set logical size
    canvas.width = BALANCE.ARENA_SIZE;
    canvas.height = BALANCE.ARENA_SIZE;

    // Pixel-perfect scaling
    this.ctx.imageSmoothingEnabled = false;
  }

  startRenderLoop() {
    const render = () => {
      this.draw();
      this.animFrame = requestAnimationFrame(render);
    };
    render();
  }

  stopRenderLoop() {
    cancelAnimationFrame(this.animFrame);
  }

  private draw() {
    const ctx = this.ctx;
    const state = this.engine.state;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, BALANCE.ARENA_SIZE, BALANCE.ARENA_SIZE);

    // Draw subtle grid
    ctx.strokeStyle = '#2a2a4e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < BALANCE.ARENA_SIZE; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, BALANCE.ARENA_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i); ctx.lineTo(BALANCE.ARENA_SIZE, i);
      ctx.stroke();
    }

    // Draw bastion center indicator
    ctx.strokeStyle = '#3a5a8e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(BALANCE.CENTER, BALANCE.CENTER, 8, 0, Math.PI * 2);
    ctx.stroke();

    // Draw enemies
    for (const enemy of state.enemies) {
      this.drawEnemy(enemy);
    }

    // Draw active pokemon (centered)
    if (state.activeEntity) {
      this.drawPokemon(state.activeEntity);
    }

    // Draw projectiles
    for (const proj of state.projectiles) {
      const color = TYPE_COLORS[proj.type] || '#ffffff';
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(proj.x) - 1, Math.floor(proj.y) - 1, 3, 3);
    }

    // Draw floating damage text
    ctx.font = '6px monospace';
    ctx.textAlign = 'center';
    for (const ft of state.floatingTexts) {
      const alpha = ft.life / ft.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, Math.floor(ft.x), Math.floor(ft.y));
    }
    ctx.globalAlpha = 1;

    // HP bar for active pokemon
    if (state.activeEntity) {
      this.drawHpBar(
        BALANCE.CENTER - 10, BALANCE.CENTER + 10,
        20, 3,
        state.activeEntity.hp / state.activeEntity.maxHp,
        '#44ff44'
      );
    }

    // Boss HP bar at top
    const boss = state.enemies.find(e => e.isBoss || e.isMiniBoss);
    if (boss) {
      this.drawHpBar(4, 4, BALANCE.ARENA_SIZE - 8, 4, boss.hp / boss.maxHp, '#ff4444');
      // Boss timer
      if (boss.bossTimerSec !== undefined) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(boss.bossTimerSec)}s`, BALANCE.CENTER, 14);
      }
    }
  }

  private drawPokemon(entity: { pokemonId: string; x: number; y: number; hp: number; maxHp: number; types: string[] }) {
    const ctx = this.ctx;
    const def = getPokemonDef(entity.pokemonId);
    const color = def ? TYPE_COLORS[def.types[0]] || '#44aaff' : '#44aaff';

    // Body (8x8 pixel art placeholder)
    ctx.fillStyle = color;
    const x = Math.floor(BALANCE.CENTER - 4);
    const y = Math.floor(BALANCE.CENTER - 4);
    ctx.fillRect(x, y, 8, 8);

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 2, y + 2, 2, 2);
    ctx.fillRect(x + 5, y + 2, 2, 2);

    // Dark outline
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, 8, 8);

    // Name label below
    ctx.font = '5px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(def?.name?.substring(0, 8) || '???', BALANCE.CENTER, BALANCE.CENTER + 18);
  }

  private drawEnemy(entity: { pokemonId: string; x: number; y: number; hp: number; maxHp: number; isBoss: boolean; isMiniBoss: boolean }) {
    const ctx = this.ctx;
    const color = ENEMY_COLORS[entity.pokemonId] || '#cc4444';
    const size = entity.isBoss ? 10 : entity.isMiniBoss ? 8 : 6;
    const half = Math.floor(size / 2);

    const ex = Math.floor(entity.x) - half;
    const ey = Math.floor(entity.y) - half;

    ctx.fillStyle = color;
    ctx.fillRect(ex, ey, size, size);

    // Red eyes
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(ex + 1, ey + 1, 1, 1);
    ctx.fillRect(ex + size - 2, ey + 1, 1, 1);

    // Mini HP bar
    if (entity.hp < entity.maxHp) {
      this.drawHpBar(ex, ey - 3, size, 2, entity.hp / entity.maxHp, '#44ff44');
    }
  }

  private drawHpBar(x: number, y: number, w: number, h: number, ratio: number, color: string) {
    const ctx = this.ctx;
    ctx.fillStyle = '#000000';
    ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x) + 1, Math.floor(y) + 1, Math.floor((w - 2) * Math.max(0, ratio)), h - 2);
  }

  // Handle click -> logical coords
  canvasToLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = BALANCE.ARENA_SIZE / rect.width;
    const scaleY = BALANCE.ARENA_SIZE / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }
}
