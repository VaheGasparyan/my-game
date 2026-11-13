const KEY = 'vanta.settings.v1';

export const DEFAULTS = {
  name: 'You',
  sensitivity: 1,
  fov: 90,
  volume: 0.7,
  invertY: false,
  shadows: true,
  showFps: false,
  difficulty: 'normal',
  teamSize: 4,
  duration: 300,
  scoreLimit: 30,
};

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode) — settings just won't persist */
  }
}
