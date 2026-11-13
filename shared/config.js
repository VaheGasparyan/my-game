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

// Every weapon in the game. `slot` decides where it sits in a loadout.
// zoom  : FOV multiplier while aiming (lower = more zoom)
// pellets: rays per shot (shotguns)        scope: full-screen scope overlay while aiming
// projectile: fires an explosive round instead of a bullet (grenade launcher)
export const WEAPONS = [
  {
    id: 'ak47', name: 'AK-47', slot: 'primary', auto: true,
    damage: 27, headMult: 2, rpm: 600, mag: 30, reserve: 120, reloadTime: 2.3,
    spread: 0.014, adsSpread: 0.004, moveSpread: 0.024, bloomPerShot: 0.008, maxBloom: 0.06,
    recoil: 0.016, range: 120, zoom: 0.72,
  },
  {
    id: 'rifle', name: 'VR-9 Rifle', slot: 'primary', auto: true,
    damage: 21, headMult: 2, rpm: 720, mag: 30, reserve: 120, reloadTime: 1.9,
    spread: 0.012, adsSpread: 0.003, moveSpread: 0.02, bloomPerShot: 0.005, maxBloom: 0.045,
    recoil: 0.009, range: 120, zoom: 0.72,
  },
  {
    id: 'smg', name: 'MX-7 SMG', slot: 'primary', auto: true,
    damage: 15, headMult: 1.8, rpm: 900, mag: 35, reserve: 175, reloadTime: 1.6,
    spread: 0.02, adsSpread: 0.008, moveSpread: 0.008, bloomPerShot: 0.004, maxBloom: 0.04,
    recoil: 0.007, range: 60, zoom: 0.8,
  },
  {
    id: 'shotgun', name: 'Breaker-12', slot: 'primary', auto: false, pellets: 8,
    damage: 14, headMult: 1.5, rpm: 75, mag: 6, reserve: 30, reloadTime: 2.4,
    spread: 0.07, adsSpread: 0.05, moveSpread: 0.01, bloomPerShot: 0, maxBloom: 0,
    recoil: 0.05, range: 40, zoom: 0.82,
  },
  {
    id: 'sniper', name: 'Longbow', slot: 'primary', auto: false, scope: true,
    damage: 110, headMult: 2, rpm: 45, mag: 5, reserve: 25, reloadTime: 2.6,
    spread: 0.05, adsSpread: 0, moveSpread: 0.05, bloomPerShot: 0, maxBloom: 0,
    recoil: 0.06, range: 200, zoom: 0.28,
  },
  {
    id: 'launcher', name: 'Thumper GL', slot: 'primary', auto: false,
    // fires an arcing explosive round that detonates on impact (see Game._launchGrenade)
    projectile: { speed: 32, fuse: 3, radius: 5.5, damage: 105, impact: true },
    damage: 105, headMult: 1, rpm: 55, mag: 4, reserve: 16, reloadTime: 2.8,
    spread: 0.012, adsSpread: 0.004, moveSpread: 0.012, bloomPerShot: 0, maxBloom: 0,
    recoil: 0.045, range: 60, zoom: 0.82,
  },
  {
    id: 'pistol', name: 'P-3 Sidearm', slot: 'secondary', auto: false,
    damage: 34, headMult: 2, rpm: 360, mag: 12, reserve: 60, reloadTime: 1.3,
    spread: 0.008, adsSpread: 0.002, moveSpread: 0.012, bloomPerShot: 0.012, maxBloom: 0.05,
    recoil: 0.02, range: 80, zoom: 0.8,
  },
];

export const WEAPON_INDEX = Object.fromEntries(WEAPONS.map((w, i) => [w.id, i]));
export const PRIMARIES = WEAPONS.filter((w) => w.slot === 'primary');
export const DEFAULT_PRIMARY = 'ak47';
export const SIDEARM = 'pistol';
export const BOT_PRIMARIES = ['ak47', 'rifle', 'smg'];

/** The weapon a soldier currently has in hand. soldier.weapon is the loadout slot (0 primary, 1 sidearm). */
export function weaponOf(s) {
  return WEAPONS[s.loadout[s.weapon]];
}

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
