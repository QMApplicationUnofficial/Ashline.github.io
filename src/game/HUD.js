import { WEAPONS } from './WeaponSystem.js';
import { Minimap } from './Minimap.js';

export class HUD {
  constructor(root, map, settings, callbacks) {
    this.root = root;
    this.map = map;
    this.settings = settings;
    this.callbacks = callbacks;
    this.killItems = [];
    this.root.insertAdjacentHTML('beforeend', this.template());
    this.nodes = this.bindNodes();
    this.minimap = new Minimap(this.nodes.minimap, map);
    this.bindEvents();
    this.renderLoadouts(0);
    this.renderSettings();
    this.showMain(true);
  }

  template() {
    return `
      <div class="screen-layer hud">
        <canvas class="minimap" width="168" height="168"></canvas>
        <div class="top-bar">
          <div class="score"><span class="atk">0</span><strong>ATK</strong></div>
          <div class="timer">1:55</div>
          <div class="score"><strong>DEF</strong><span class="def">0</span></div>
          <div class="round-state">Buy</div>
        </div>
        <div class="objective-card">
          <label>Objective</label>
          <div class="objective-text">Plant the charge</div>
        </div>
        <div class="kill-feed"></div>
        <div class="bottom-bar">
          <div class="stat"><label>Health</label><strong class="health">100</strong></div>
          <div class="stat"><label>Armor</label><strong class="armor">50</strong></div>
          <div class="stat"><label>Credits</label><strong class="money">800</strong></div>
        </div>
        <div class="weapon-card">
          <label>Weapon</label>
          <div class="weapon-name">Ravelin AR</div>
          <div class="ammo">24 <small>/ 96</small></div>
        </div>
        <div class="interaction-card">
          <div class="interaction-text"></div>
          <div class="progress"><span></span></div>
        </div>
        <div class="crosshair"></div>
        <div class="hit-marker"></div>
        <div class="damage-vignette"></div>
      </div>

      <section class="menu visible">
        <div class="panel">
          <div class="brand">
            <h1>Ashline</h1>
            <p>Original 3D tactical browser prototype with procedural dust, generated textures, and defender bots.</p>
          </div>
          <div class="menu-grid">
            <div>
              <div class="key-list">
                <div><span>WASD</span> Move</div>
                <div><span>Mouse</span> Look</div>
                <div><span>Click</span> Shoot</div>
                <div><span>R</span> Reload</div>
                <div><span>E</span> Plant</div>
                <div><span>B</span> Buy</div>
                <div><span>Shift</span> Sprint</div>
                <div><span>Esc</span> Pause</div>
              </div>
              <div class="button-row">
                <button class="button primary start">Start Round</button>
                <button class="button open-settings">Settings</button>
              </div>
            </div>
            <div>
              <span class="status-chip">GitHub Pages ready</span>
              <p style="color: var(--ash-muted); line-height: 1.45; margin: 14px 0 0;">
                Click start to lock the pointer and initialize generated audio.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="pause">
        <div class="panel">
          <div class="brand">
            <h1 style="font-size: clamp(38px, 7vw, 68px);">Paused</h1>
            <p>Adjust quality or resume the round.</p>
          </div>
          <div class="button-row">
            <button class="button primary resume">Resume</button>
            <button class="button open-settings">Settings</button>
            <button class="button restart">Restart Round</button>
          </div>
        </div>
      </section>

      <section class="buy-menu">
        <div class="panel">
          <div class="brand">
            <h1 style="font-size: clamp(34px, 6vw, 62px);">Loadout</h1>
            <p>Select a weapon during buy phase. Number keys also switch weapons in round.</p>
          </div>
          <div class="loadouts"></div>
          <div class="button-row">
            <button class="button primary close-buy">Close</button>
          </div>
        </div>
      </section>

      <section class="settings">
        <div class="panel">
          <div class="brand">
            <h1 style="font-size: clamp(34px, 6vw, 62px);">Settings</h1>
            <p>Performance controls keep the dust, shadows, and generated materials scalable.</p>
          </div>
          <div class="setting-row">
            <label>Preset</label>
            <select data-setting="graphicsPreset">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <output></output>
          </div>
          <div class="setting-row">
            <label>Mouse</label>
            <input type="range" min="0.35" max="1.7" step="0.01" data-setting="mouseSensitivity" />
            <output></output>
          </div>
          <div class="setting-row">
            <label>Volume</label>
            <input type="range" min="0" max="1" step="0.01" data-setting="volume" />
            <output></output>
          </div>
          <div class="setting-row">
            <label>Shadows</label>
            <select data-setting="shadowQuality">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <output></output>
          </div>
          <div class="setting-row">
            <label>Dust</label>
            <input type="range" min="0.15" max="1" step="0.01" data-setting="dustDensity" />
            <output></output>
          </div>
          <div class="setting-row">
            <label>Render Scale</label>
            <input type="range" min="0.6" max="1" step="0.01" data-setting="renderScale" />
            <output></output>
          </div>
          <div class="button-row">
            <button class="button primary close-settings">Done</button>
          </div>
        </div>
      </section>
    `;
  }

  bindNodes() {
    return {
      main: this.root.querySelector('.menu'),
      pause: this.root.querySelector('.pause'),
      buy: this.root.querySelector('.buy-menu'),
      settings: this.root.querySelector('.settings'),
      minimap: this.root.querySelector('.minimap'),
      atkScore: this.root.querySelector('.atk'),
      defScore: this.root.querySelector('.def'),
      timer: this.root.querySelector('.timer'),
      state: this.root.querySelector('.round-state'),
      objective: this.root.querySelector('.objective-text'),
      health: this.root.querySelector('.health'),
      armor: this.root.querySelector('.armor'),
      money: this.root.querySelector('.money'),
      weaponName: this.root.querySelector('.weapon-name'),
      ammo: this.root.querySelector('.ammo'),
      interaction: this.root.querySelector('.interaction-card'),
      interactionText: this.root.querySelector('.interaction-text'),
      interactionProgress: this.root.querySelector('.interaction-card .progress span'),
      killFeed: this.root.querySelector('.kill-feed'),
      hitMarker: this.root.querySelector('.hit-marker'),
      damage: this.root.querySelector('.damage-vignette'),
      loadouts: this.root.querySelector('.loadouts')
    };
  }

  bindEvents() {
    this.root.querySelectorAll('.start').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.onStart?.());
    });
    this.root.querySelectorAll('.resume').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.onResume?.());
    });
    this.root.querySelectorAll('.restart').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.onRestart?.());
    });
    this.root.querySelectorAll('.open-settings').forEach((button) => {
      button.addEventListener('click', () => this.showSettings(true));
    });
    this.root.querySelectorAll('.close-settings').forEach((button) => {
      button.addEventListener('click', () => this.showSettings(false));
    });
    this.root.querySelectorAll('.close-buy').forEach((button) => {
      button.addEventListener('click', () => this.showBuy(false));
    });

    this.root.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.setting;
        const value = input.tagName === 'SELECT' ? input.value : Number(input.value);
        this.settings.set(key, value);
        this.renderSettings();
      });
    });
  }

  renderLoadouts(activeIndex) {
    this.nodes.loadouts.innerHTML = WEAPONS.map(
      (weapon, index) => `
        <div class="loadout ${index === activeIndex ? 'active' : ''}" data-index="${index}">
          <h3>${index + 1}. ${weapon.name}</h3>
          <p>${weapon.note}</p>
          <span class="status-chip">${weapon.magSize} mag / ${weapon.damage} dmg</span>
        </div>
      `
    ).join('');
    this.nodes.loadouts.querySelectorAll('.loadout').forEach((card) => {
      card.addEventListener('click', () => {
        const index = Number(card.dataset.index);
        this.callbacks.onWeaponSelect?.(index);
        this.renderLoadouts(index);
      });
    });
  }

  renderSettings() {
    const values = this.settings.values;
    this.root.querySelectorAll('[data-setting]').forEach((input) => {
      const key = input.dataset.setting;
      input.value = values[key];
      const output = input.parentElement.querySelector('output');
      output.textContent = typeof values[key] === 'number' ? values[key].toFixed(2) : values[key];
    });
  }

  update({ player, weapons, round, bots }) {
    const weapon = weapons.active;
    this.nodes.atkScore.textContent = round.attackers;
    this.nodes.defScore.textContent = round.defenders;
    this.nodes.timer.textContent = round.getTimerText();
    this.nodes.state.textContent = round.roundState;
    this.nodes.objective.textContent = round.getObjectiveText();
    this.nodes.health.textContent = Math.ceil(player.health);
    this.nodes.armor.textContent = Math.ceil(player.armor);
    this.nodes.money.textContent = player.money;
    this.nodes.weaponName.textContent = weapon.name;
    this.nodes.ammo.innerHTML = `${weapon.ammo}${weapon.reload > 0 ? '...' : ''} <small>/ ${weapon.reserveAmmo}</small>`;

    if (round.interactionText) {
      this.nodes.interaction.classList.add('visible');
      this.nodes.interactionText.textContent = round.interactionText;
      this.nodes.interactionProgress.style.width = `${Math.min(100, round.interactionProgress * 100)}%`;
    } else {
      this.nodes.interaction.classList.remove('visible');
      this.nodes.interactionProgress.style.width = '0%';
    }

    this.nodes.damage.classList.toggle('visible', player.damageFlash > 0.05);
    this.minimap.draw(player, bots, round);
    this.expireKillFeed();
  }

  addKill(killer, victim, weaponName) {
    this.killItems.unshift({
      killer,
      victim,
      weaponName,
      expires: performance.now() + 4200
    });
    this.killItems = this.killItems.slice(0, 5);
    this.renderKillFeed();
  }

  expireKillFeed() {
    const before = this.killItems.length;
    const now = performance.now();
    this.killItems = this.killItems.filter((item) => item.expires > now);
    if (this.killItems.length !== before) this.renderKillFeed();
  }

  renderKillFeed() {
    this.nodes.killFeed.innerHTML = this.killItems
      .map(
        (item) => `
          <div><span class="killer">${item.killer}</span><span>${item.weaponName}</span><span>${item.victim}</span></div>
        `
      )
      .join('');
  }

  showHit() {
    this.nodes.hitMarker.classList.add('visible');
    window.clearTimeout(this.hitTimeout);
    this.hitTimeout = window.setTimeout(() => this.nodes.hitMarker.classList.remove('visible'), 100);
  }

  showMain(visible) {
    this.nodes.main.classList.toggle('visible', visible);
  }

  showPause(visible) {
    this.nodes.pause.classList.toggle('visible', visible);
  }

  showBuy(visible) {
    this.nodes.buy.classList.toggle('visible', visible);
  }

  showSettings(visible) {
    this.nodes.settings.classList.toggle('visible', visible);
  }
}
