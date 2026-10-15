// src/core/engine.ts — Headless pure TS game engine, zero DOM dependencies
import type {
  GameState, GameAction, Entity, Projectile, FloatingText,
  TeamMember, Upgrades, PokemonDefinition
} from './types';
import { BALANCE } from '../config/balance.config';
import { STARTERS } from '../data/starters';
import { calculateDamage, calculateClickDamage, getTypeMultiplier } from './damage';
import { getEvolvedId, getPokemonDef } from './evolution';
import { moveTowardsCenter, distanceToCenter, distanceBetween } from './movement';
import {
  spawnWaveEnemies, spawnMiniBoss, spawnBoss,
  isBossFloor, isMiniBossFloor, calculateRuna, getWaveDuration
} from './wave';

let nextId = 1;

function createInitialUpgrades(): Upgrades {
  return {
    teamLevel: 1,
    teamLevelCost: BALANCE.BASE_TEAM_LEVEL_COST,
    UP_CLICK: 0, UP_HP: 0, UP_MULTI: 0, UP_ARROW: 0,
    UP_SPD: 0, UP_CRIT: 0, UP_CDMG: 0, UP_GOLD: 0,
  };
}

function createInitialState(): GameState {
  return {
    phase: 'STARTER_SELECT',
    floor: 1,
    waveTimerSec: BALANCE.BASE_WAVE_DURATION_SEC,
    gold: 0,
    runaEarned: 0,
    upgrades: createInitialUpgrades(),
    team: [null, null, null, null, null, null],
    activeIndex: 0,
    activeEntity: null,
    enemies: [],
    projectiles: [],
    floatingTexts: [],
    bastionHp: BALANCE.BASE_BASTION_HP,
    bastionMaxHp: BALANCE.BASE_BASTION_HP,
    autoFireTimer: 0,
    bossActive: false,
    ultimateCharge: 0,
    totalKills: 0,
    totalDamage: 0,
    elapsedSec: 0,
  };
}

function buildTeamMember(pokemonId: string, teamLevel: number): TeamMember {
  const evoId = getEvolvedId(pokemonId, teamLevel);
  const def = getPokemonDef(evoId);
  if (!def) {
    // fallback
    return {
      pokemonId,
      currentEvolutionId: pokemonId,
      hp: 50, maxHp: 50,
      switchCooldown: 0,
    };
  }
  const maxHp = 50 + def.baseStats.atk * 3;
  return {
    pokemonId,
    currentEvolutionId: evoId,
    hp: maxHp,
    maxHp,
    switchCooldown: 0,
  };
}

function makeActiveEntity(member: TeamMember, upgrades: Upgrades): Entity {
  const def = getPokemonDef(member.currentEvolutionId);
  if (!def) {
    return {
      id: nextId++,
      pokemonId: member.currentEvolutionId,
      x: BALANCE.CENTER, y: BALANCE.CENTER,
      hp: member.hp, maxHp: member.maxHp,
      speed: 0, types: ['NORMAL'],
      atk: 10, spd: 1, critRate: 0.05, critDmg: 2,
      angle: 0, isBoss: false, isMiniBoss: false,
    };
  }
  const lvlMult = 1 + upgrades.teamLevel * 0.1;
  return {
    id: nextId++,
    pokemonId: member.currentEvolutionId,
    x: BALANCE.CENTER, y: BALANCE.CENTER,
    hp: member.hp, maxHp: member.maxHp,
    speed: 0,
    types: [...def.types],
    atk: Math.floor(def.baseStats.atk * lvlMult * (1 + upgrades.UP_ARROW * 0.15)),
    spd: def.baseStats.spd * (1 + upgrades.UP_SPD * 0.08),
    critRate: def.baseStats.critRate + upgrades.UP_CRIT * 0.02,
    critDmg: def.baseStats.critDmg + upgrades.UP_CDMG * 0.1,
    angle: 0,
    isBoss: false,
    isMiniBoss: false,
  };
}

function upgradeCost(currentLevel: number): number {
  return Math.floor(10 * Math.pow(BALANCE.UPGRADE_COST_SCALE, currentLevel));
}

function teamLevelCost(level: number): number {
  return Math.floor(BALANCE.BASE_TEAM_LEVEL_COST * Math.pow(BALANCE.TEAM_LEVEL_COST_SCALE, level - 1));
}

export class GameEngine {
  state: GameState;
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private fixedDt = 1 / BALANCE.TICK_RATE;
  private onStateChange: (() => void) | null = null;

  constructor() {
    this.state = createInitialState();
  }

  setOnStateChange(cb: () => void) {
    this.onStateChange = cb;
  }

  dispatch(action: GameAction) {
    switch (action.type) {
      case 'SELECT_STARTER': {
        if (this.state.phase !== 'STARTER_SELECT') return;
        const starter = STARTERS.find(s => s.id === action.pokemonId);
        if (!starter) return;
        const member = buildTeamMember(action.pokemonId, 1);
        this.state.team[0] = member;
        this.state.activeIndex = 0;
        this.state.activeEntity = makeActiveEntity(member, this.state.upgrades);
        this.state.phase = 'PLAYING';
        this.state.enemies = spawnWaveEnemies(1);
        this.notify();
        break;
      }
      case 'HOT_SWAP': {
        if (this.state.phase !== 'PLAYING') return;
        const idx = action.index;
        if (idx < 0 || idx > 5 || idx === this.state.activeIndex) return;
        const member = this.state.team[idx];
        if (!member) return;
        if (member.switchCooldown > 0) return;

        // Save current hp to old member
        if (this.state.activeEntity) {
          const oldMember = this.state.team[this.state.activeIndex];
          if (oldMember) oldMember.hp = this.state.activeEntity.hp;
        }

        this.state.activeIndex = idx;
        this.state.activeEntity = makeActiveEntity(member, this.state.upgrades);

        // Set cooldown on ALL team members
        for (const m of this.state.team) {
          if (m) m.switchCooldown = BALANCE.SWITCH_COOLDOWN_SEC;
        }

        // Switch-in bonus damage to all enemies
        if (this.state.activeEntity) {
          const bonusMult = BALANCE.SWITCH_IN_DMG_MULTIPLIER;
          for (const enemy of this.state.enemies) {
            const typeMult = getTypeMultiplier(
              this.state.activeEntity.types[0],
              enemy.types
            );
            const bonusDmg = Math.floor(this.state.activeEntity.atk * bonusMult * typeMult);
            enemy.hp -= bonusDmg;
            this.addFloatingText(enemy.x, enemy.y, `${bonusDmg}`, '#00ff88');
          }
        }
        this.notify();
        break;
      }
      case 'UPGRADE_TEAM_LEVEL': {
        const cost = this.state.upgrades.teamLevelCost;
        if (this.state.gold < cost) return;
        this.state.gold -= cost;
        this.state.upgrades.teamLevel += 1;
        this.state.upgrades.teamLevelCost = teamLevelCost(this.state.upgrades.teamLevel);

        // Check evolutions for all team members
        for (let i = 0; i < 6; i++) {
          const member = this.state.team[i];
          if (!member) continue;
          const newEvoId = getEvolvedId(member.pokemonId, this.state.upgrades.teamLevel);
          if (newEvoId !== member.currentEvolutionId) {
            member.currentEvolutionId = newEvoId;
            const def = getPokemonDef(newEvoId);
            if (def) {
              const newMaxHp = 50 + def.baseStats.atk * 3;
              member.maxHp = newMaxHp;
              member.hp = newMaxHp;
            }
          }
        }

        // Rebuild active entity
        const active = this.state.team[this.state.activeIndex];
        if (active) {
          const oldHp = this.state.activeEntity?.hp ?? active.hp;
          this.state.activeEntity = makeActiveEntity(active, this.state.upgrades);
          this.state.activeEntity.hp = Math.min(oldHp, this.state.activeEntity.maxHp);
        }
        this.notify();
        break;
      }
      case 'UPGRADE': {
        const key = action.key;
        const currentLevel = this.state.upgrades[key];
        const cost = upgradeCost(currentLevel);
        if (this.state.gold < cost) return;
        this.state.gold -= cost;
        (this.state.upgrades as any)[key] = currentLevel + 1;

        // HP upgrade increases bastion max hp
        if (key === 'UP_HP') {
          this.state.bastionMaxHp = BALANCE.BASE_BASTION_HP + this.state.upgrades.UP_HP * 20;
          this.state.bastionHp = Math.min(this.state.bastionHp + 20, this.state.bastionMaxHp);
        }

        // Rebuild active entity stats
        const active = this.state.team[this.state.activeIndex];
        if (active) {
          const oldHp = this.state.activeEntity?.hp ?? active.hp;
          this.state.activeEntity = makeActiveEntity(active, this.state.upgrades);
          this.state.activeEntity.hp = Math.min(oldHp, this.state.activeEntity.maxHp);
        }
        this.notify();
        break;
      }
      case 'CLICK_DAMAGE': {
        if (this.state.phase !== 'PLAYING' || !this.state.activeEntity) return;
        const ae = this.state.activeEntity;
        // Find nearest enemy to click position
        let nearest: Entity | null = null;
        let nearestDist = Infinity;
        for (const e of this.state.enemies) {
          const d = distanceBetween(action.x, action.y, e.x, e.y);
          if (d < nearestDist && d < 20) {
            nearestDist = d;
            nearest = e;
          }
        }
        if (nearest) {
          const { damage, isCrit } = calculateClickDamage(
            ae.atk, ae.types[0], nearest.types,
            ae.critRate, ae.critDmg,
            this.state.upgrades.UP_CLICK
          );
          nearest.hp -= damage;
          this.state.totalDamage += damage;
          this.addFloatingText(nearest.x, nearest.y, `${damage}${isCrit ? '!' : ''}`, isCrit ? '#ffff00' : '#ffffff');
          this.state.ultimateCharge = Math.min(1, this.state.ultimateCharge + 0.02);
          this.state.gold += Math.floor(1 * (1 + this.state.upgrades.UP_GOLD * 0.1));
        }
        break;
      }
      case 'USE_ULTIMATE': {
        if (this.state.ultimateCharge < 1 || !this.state.activeEntity) return;
        this.state.ultimateCharge = 0;
        const ae = this.state.activeEntity;
        // AoE damage to all enemies
        for (const enemy of this.state.enemies) {
          const { damage } = calculateDamage(
            ae.atk * 5, ae.types[0], enemy.types,
            1.0, 3.0
          );
          enemy.hp -= damage;
          this.state.totalDamage += damage;
          this.addFloatingText(enemy.x, enemy.y, `${damage}`, '#ff00ff');
        }
        break;
      }
      case 'RESTART': {
        this.state = createInitialState();
        this.notify();
        break;
      }
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string) {
    this.state.floatingTexts.push({
      id: nextId++, x, y, text, color,
      life: 1.0, maxLife: 1.0,
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
  }

  private loop(time: number) {
    if (!this.running) return;
    const frameDt = Math.min((time - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = time;
    this.accumulator += frameDt;

    while (this.accumulator >= this.fixedDt) {
      this.tick(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    this.notify();
    requestAnimationFrame((t) => this.loop(t));
  }

  private tick(dt: number) {
    if (this.state.phase !== 'PLAYING') return;
    this.state.elapsedSec += dt;

    // Cooldowns
    for (const m of this.state.team) {
      if (m && m.switchCooldown > 0) m.switchCooldown = Math.max(0, m.switchCooldown - dt);
    }

    // Auto-fire
    if (this.state.activeEntity) {
      this.state.autoFireTimer -= dt;
      if (this.state.autoFireTimer <= 0) {
        this.fire();
        this.state.autoFireTimer = 1 / this.state.activeEntity.spd;
      }
    }

    // Move enemies toward center
    for (const enemy of this.state.enemies) {
      const pos = moveTowardsCenter(enemy.x, enemy.y, enemy.angle, enemy.speed, dt);
      enemy.x = pos.x;
      enemy.y = pos.y;

      // Enemy reached bastion?
      if (distanceToCenter(enemy.x, enemy.y) < 5) {
        this.state.bastionHp -= enemy.atk * dt;
      }
    }

    // Move projectiles
    for (const proj of this.state.projectiles) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
    }

    // Collision: projectiles vs enemies
    const aliveProjectiles: Projectile[] = [];
    for (const proj of this.state.projectiles) {
      let hit = false;
      for (const enemy of this.state.enemies) {
        if (proj.pierced.has(enemy.id)) continue;
        if (distanceBetween(proj.x, proj.y, enemy.x, enemy.y) < 8) {
          const typeMult = getTypeMultiplier(proj.type, enemy.types);
          const dmg = Math.floor(proj.damage * typeMult);
          enemy.hp -= dmg;
          this.state.totalDamage += dmg;
          proj.pierced.add(enemy.id);
          this.addFloatingText(enemy.x, enemy.y, `${dmg}`, typeMult > 1 ? '#00ff88' : '#ffffff');

          // Charge ultimate
          this.state.ultimateCharge = Math.min(1, this.state.ultimateCharge + 0.01);

          if (proj.maxBounces > 0) {
            proj.maxBounces--;
          } else {
            hit = true;
          }
          break;
        }
      }
      // Out of bounds?
      if (proj.x < -10 || proj.x > 154 || proj.y < -10 || proj.y > 154) hit = true;
      if (!hit) aliveProjectiles.push(proj);
    }
    this.state.projectiles = aliveProjectiles;

    // Remove dead enemies, award gold
    const aliveEnemies: Entity[] = [];
    for (const enemy of this.state.enemies) {
      if (enemy.hp <= 0) {
        this.state.totalKills++;
        const goldGain = Math.floor(
          BALANCE.BASE_GOLD_PER_KILL *
          Math.pow(BALANCE.GOLD_SCALE_PER_FLOOR, this.state.floor) *
          (1 + this.state.upgrades.UP_GOLD * 0.1) *
          (enemy.isBoss ? 20 : enemy.isMiniBoss ? 5 : 1)
        );
        this.state.gold += goldGain;
        this.addFloatingText(enemy.x, enemy.y, `+${goldGain}g`, '#ffd700');
      } else {
        aliveEnemies.push(enemy);
      }
    }
    this.state.enemies = aliveEnemies;

    // Boss timer
    if (this.state.bossActive) {
      const bossEnemy = this.state.enemies.find(e => e.isBoss || e.isMiniBoss);
      if (bossEnemy && bossEnemy.bossTimerSec !== undefined) {
        bossEnemy.bossTimerSec -= dt;
        this.state.waveTimerSec = bossEnemy.bossTimerSec;
        if (bossEnemy.bossTimerSec <= 0) {
          // Timer expired = game over
          this.gameOver();
          return;
        }
      } else if (!bossEnemy) {
        // Boss defeated, advance floor
        this.advanceFloor();
      }
    } else {
      // Normal wave: advance when all enemies dead
      this.state.waveTimerSec -= dt;
      if (this.state.enemies.length === 0 || this.state.waveTimerSec <= 0) {
        this.advanceFloor();
      }
    }

    // Floating text decay
    for (const ft of this.state.floatingTexts) {
      ft.life -= dt;
      ft.y -= 15 * dt; // float up
    }
    this.state.floatingTexts = this.state.floatingTexts.filter(ft => ft.life > 0);

    // Bastion regen
    const regenRate = BALANCE.BASTION_REGEN_PER_SEC * this.state.bastionMaxHp;
    this.state.bastionHp = Math.min(this.state.bastionMaxHp, this.state.bastionHp + regenRate * dt);

    // Sync team member HP from active entity
    if (this.state.activeEntity) {
      const active = this.state.team[this.state.activeIndex];
      if (active) active.hp = this.state.activeEntity.hp;
    }

    // Game over check
    if (this.state.bastionHp <= 0) {
      this.gameOver();
    }
  }

  private fire() {
    if (!this.state.activeEntity || this.state.enemies.length === 0) return;
    const ae = this.state.activeEntity;
    const def = getPokemonDef(ae.pokemonId);
    if (!def) return;

    const multiCount = 1 + this.state.upgrades.UP_MULTI;

    // Find nearest enemies
    const sorted = [...this.state.enemies].sort((a, b) =>
      distanceBetween(ae.x, ae.y, a.x, a.y) - distanceBetween(ae.x, ae.y, b.x, b.y)
    );

    const targets = sorted.slice(0, Math.min(multiCount, sorted.length));

    for (const target of targets) {
      const dx = target.x - ae.x;
      const dy = target.y - ae.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const speed = 120; // px/sec
      const vx = (dx / dist) * speed;
      const vy = (dy / dist) * speed;

      const { damage } = calculateDamage(
        ae.atk, ae.types[0], target.types,
        ae.critRate, ae.critDmg
      );

      this.state.projectiles.push({
        id: nextId++,
        x: ae.x, y: ae.y,
        vx, vy, damage,
        type: ae.types[0],
        pattern: def.pattern,
        pierced: new Set<number>(),
        maxBounces: def.pattern === 'CHAIN' ? this.state.upgrades.UP_MULTI : 0,
      });
    }
  }

  private advanceFloor() {
    this.state.floor++;
    this.state.bossActive = false;

    if (isBossFloor(this.state.floor)) {
      this.state.enemies = [spawnBoss(this.state.floor)];
      this.state.bossActive = true;
      this.state.waveTimerSec = BALANCE.BOSS_TIMER_SEC;
    } else if (isMiniBossFloor(this.state.floor)) {
      this.state.enemies = [spawnMiniBoss(this.state.floor)];
      this.state.bossActive = true;
      this.state.waveTimerSec = BALANCE.BOSS_TIMER_SEC;
    } else {
      this.state.enemies = spawnWaveEnemies(this.state.floor);
      this.state.waveTimerSec = getWaveDuration(this.state.floor);
    }
    this.notify();
  }

  private gameOver() {
    this.state.phase = 'GAME_OVER';
    this.state.runaEarned = calculateRuna(this.state.floor);
    this.running = false;
    this.notify();
  }

  private notify() {
    this.onStateChange?.();
  }
}
