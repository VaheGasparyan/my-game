// Gameplay constants shared by the client and (later) the authoritative server.

export const GAME_TITLE = 'VANTA';

export const TEAM_BLUE = 0;
export const TEAM_ORANGE = 1;

export const TEAM_INFO = [
  { name: 'BLUE', color: 0x2a62f0, css: '#3b82ff' },
  { name: 'ORANGE', color: 0xf07a1e, css: '#ff8a2a' },
];

export const PLAYER = {
  radius: 0.4,
  height: 1.8,
  eye: 1.62,
  step: 0.45,
  walkSpeed: 6.0,
  sprintSpeed: 8.4,
  adsSpeed: 3.6,
  jumpSpeed: 7.2,
  gravity: 22,
  groundAccel: 70,
  airAccel: 16,
  maxHealth: 100,
  maxShield: 75,
  shieldRegenDelay: 5,
  shieldRegenRate: 18,
  respawnTime: 3,
  spawnProtection: 1.5,
};

export const WEAPONS = [
  {
    id: 'rifle',
    name: 'VR-9 Rifle',
    auto: true,
    damage: 22,
    headMult: 2,
    rpm: 600,
    mag: 30,
    reserve: 120,
    reloadTime: 1.9,
    spread: 0.012,
    adsSpread: 0.003,
    moveSpread: 0.02,
    bloomPerShot: 0.006,
    maxBloom: 0.045,
    recoil: 0.011,
    range: 120,
  },
  {
    id: 'pistol',
    name: 'P-3 Sidearm',
    auto: false,
    damage: 34,
    headMult: 2,
    rpm: 360,
    mag: 12,
    reserve: 60,
    reloadTime: 1.3,
    spread: 0.008,
    adsSpread: 0.002,
    moveSpread: 0.012,
    bloomPerShot: 0.012,
    maxBloom: 0.05,
    recoil: 0.02,
    range: 80,
  },
];

export const ABILITIES = {
  dash: { cooldown: 6, speed: 21, duration: 0.2 },
  grenade: { cooldown: 10, fuse: 1.7, radius: 6.5, damage: 130, speed: 18 },
};

export const MATCH_DEFAULTS = {
  duration: 300,
  scoreLimit: 30,
  teamSize: 4,
  countdown: 3,
};

export const BOT_NAMES = [
  'Nova', 'Cipher', 'Rook', 'Vex', 'Jinx', 'Onyx', 'Echo', 'Blitz',
  'Kite', 'Mako', 'Zed', 'Pyre', 'Lumen', 'Dart', 'Quill', 'Hex',
];

// difficulty presets used by the bot brain
export const BOT_SKILL = {
  easy: { reaction: 0.55, aimError: 0.075, turnRate: 4.5, burst: [0.2, 0.5], pause: [0.35, 0.8], grenades: 0 },
  normal: { reaction: 0.32, aimError: 0.042, turnRate: 7.5, burst: [0.3, 0.7], pause: [0.2, 0.5], grenades: 0.5 },
  hard: { reaction: 0.18, aimError: 0.022, turnRate: 11, burst: [0.4, 0.9], pause: [0.1, 0.3], grenades: 1 },
};
