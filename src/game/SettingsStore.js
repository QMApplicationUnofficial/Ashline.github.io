const STORAGE_KEY = 'ashline.settings.v1';

const PRESETS = {
  low: {
    shadowQuality: 'low',
    dustDensity: 0.45,
    renderScale: 0.78
  },
  medium: {
    shadowQuality: 'medium',
    dustDensity: 0.72,
    renderScale: 0.92
  },
  high: {
    shadowQuality: 'high',
    dustDensity: 1,
    renderScale: 1
  }
};

const DEFAULTS = {
  mouseSensitivity: 0.88,
  volume: 0.65,
  shadowQuality: 'medium',
  dustDensity: 0.72,
  renderScale: 0.92,
  graphicsPreset: 'medium'
};

export class SettingsStore {
  constructor() {
    this.listeners = new Set();
    this.values = this.load();
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { ...DEFAULTS, ...saved };
    } catch {
      return { ...DEFAULTS };
    }
  }

  set(key, value) {
    this.values[key] = value;
    if (key === 'graphicsPreset') {
      Object.assign(this.values, PRESETS[value] ?? PRESETS.medium);
    }
    this.save();
    this.emit();
  }

  patch(values) {
    Object.assign(this.values, values);
    this.save();
    this.emit();
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    for (const listener of this.listeners) listener(this.values);
  }
}
