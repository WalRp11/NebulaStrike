// Core constants and tuning knobs.
const CANVAS_W = 1000;
const CANVAS_H = 1200;
const PLAYER_SPEED = 9;
const HIGHSCORE_KEY = 'nebulastrike_highscore_v1';

const WEAPONS = [
  { id: 'pulse',   name: 'Pulse',        color: '#00ffff', speed: 12, damage: 1,    type: 'bullet', cooldown: 170, pickupColor: '#00ffff', icon: 'P',  mass: 0.8 },
  { id: 'twin',    name: 'Twin Pulse',   color: '#ffff00', speed: 13, damage: 1,    type: 'double', cooldown: 190, pickupColor: '#ffee44', icon: 'II', mass: 0.8 },
  { id: 'spread',  name: 'Spread',       color: '#00ff88', speed: 12, damage: 1,    type: 'spread', cooldown: 210, pickupColor: '#55ff88', icon: 'S', mass: 0.7 },
  { id: 'laser',   name: 'Laser',        color: '#ff4444', speed: 20, damage: 3,    type: 'laser',  cooldown: 260, pickupColor: '#ff6677', icon: 'L', mass: 0.3 },
  { id: 'rocket',  name: 'Rockets',      color: '#ff8800', speed: 7,  damage: 8,    type: 'rocket', cooldown: 360, pickupColor: '#ffaa33', icon: 'R', mass: 4.5 },
  { id: 'beam',    name: 'Plasma Beam',  color: '#ff00ff', speed: 22, damage: 0.45, type: 'beam',   cooldown: 85,  pickupColor: '#ff66ff', icon: 'B', mass: 0.2 },
  { id: 'burst',   name: 'Burst Rail',   color: '#66ccff', speed: 19, damage: 1.6,  type: 'burst',  cooldown: 250, pickupColor: '#66ccff', icon: 'BR', mass: 1.2 },
  { id: 'shard',   name: 'Shard Cannon', color: '#88ffcc', speed: 10, damage: 1.2,  type: 'shard',  cooldown: 240, pickupColor: '#88ffcc', icon: 'SC', mass: 0.6 },
];

const ENEMY_MASS = {
  grunt: 1.2,
  kamikaze: 0.9,
  sniper: 1.8,
  drone: 0.3,
  shielded: 3.5,
  specter: 1.1,
  swarm: 0.4,
  pulsar: 2.2,
  tank: 5.0,
  phantom: 0.8,
};

const COMBO_WINDOW   = 2200;
const COMBO_TIERS    = [1, 2, 3, 4, 5, 6, 8];
const MAX_BOMBS      = 5;
const MAX_DASH       = 3;
const DASH_DURATION  = 220;
const DASH_IFRAMES   = 360;
const CHARGE_FULL_MS = 900;
const SHAKE_DECAY    = 0.86;
const PARTICLE_CAP   = 600;

const BALANCE = {
  wavePickupChance: 0.001,
  globalWeaponDropChance: 0.10,
  eliteWeaponDropChance: 0.16,
  majorHitLoseTwoThreshold: 3,
  shieldDeflectBaseCost: 0.50,
  shieldDeflectLowEnergyCost: 0.75,
  shieldDeflectRadius: 0.75,  // radius multiplier at full armor (was: 110 + ratio*65)
  shieldDeflectPower: 0.70,   // max deflection redirect power (was: 1.0)
  shieldDeflectSpeedBoost: 0.15, // outgoing speed boost ratio (was: 0.4)
  shieldMass: 2.0,
  deflectMomentumCost: 0.35,
  deflectEnergyMultiplier: 0.15,
};

const DIFFICULTY_MODES = {
  easy: {
    label: 'EASY',
    enemyHpMult: 0.65,
    enemyDamageMult: 0.55,
    enemySpawnMult: 0.75,
    bossHpMult: 0.60,
    bossDamageMult: 0.50,
    pickupDropMult: 1.4,
    playerDamageMult: 1.3,
    shieldCostMult: 0.70,
  },
  normal: {
    label: 'NORMAL',
    enemyHpMult: 1.0,
    enemyDamageMult: 1.0,
    enemySpawnMult: 1.0,
    bossHpMult: 1.0,
    bossDamageMult: 1.0,
    pickupDropMult: 1.0,
    playerDamageMult: 1.0,
    shieldCostMult: 1.0,
  },
  hard: {
    label: 'HARD',
    enemyHpMult: 1.45,
    enemyDamageMult: 1.35,
    enemySpawnMult: 1.25,
    bossHpMult: 1.50,
    bossDamageMult: 1.40,
    pickupDropMult: 0.75,
    playerDamageMult: 0.90,
    shieldCostMult: 1.25,
  },
  nightmare: {
    label: 'NIGHTMARE',
    enemyHpMult: 2.0,
    enemyDamageMult: 1.80,
    enemySpawnMult: 1.60,
    bossHpMult: 2.20,
    bossDamageMult: 1.90,
    pickupDropMult: 0.50,
    playerDamageMult: 0.80,
    shieldCostMult: 1.50,
  },
};
