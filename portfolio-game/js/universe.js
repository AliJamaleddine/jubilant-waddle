/**
 * universe.js — Orchestrates portals, camera, and gallery transitions.
 *
 * State machine:
 *   'explore'  — player walks around, camera follows
 *   'gallery'  — HTML overlay is visible, game paused
 */

class Universe {
  constructor(sceneManager, player, controls) {
    this.sm       = sceneManager;
    this.player   = player;
    this.controls = controls;

    this.state     = 'explore';   // 'explore' | 'gallery'
    this.portals   = [];
    this.nearPortal = null;

    // Camera follow params (isometric-ish third-person)
    this._camOffset    = new THREE.Vector3(0, 18, 16);
    this._camLerpSpeed = 0.06;

    // DOM refs
    this._labelEl  = document.getElementById('portal-label');
    this._nameEl   = document.getElementById('portal-name');

    this._galleryEl  = document.getElementById('gallery-overlay');
    this._categoryEl = document.getElementById('gallery-category');
    this._gridEl     = document.getElementById('gallery-grid');
    this._closeBtnEl = document.getElementById('gallery-close');

    this._closeBtnEl.addEventListener('click', () => this._closeGallery());

    // Lightbox
    this._lightboxEl = document.getElementById('lightbox');
    document.getElementById('lightbox-close').addEventListener('click', () => {
      this._lightboxEl.classList.add('hidden');
    });

    this._buildPortals();
  }

  // ─── Portal definitions ──────────────────────────────────────────────────

  _buildPortals() {
    const defs = [
      {
        name:     'Mountains',
        color:    '#5b8dee',
        position: new THREE.Vector3(-28, 2.7, -18),
        photos:   this._photos('mountains', 8),
      },
      {
        name:     'Ocean',
        color:    '#00bcd4',
        position: new THREE.Vector3(28, 2.7, -14),
        photos:   this._photos('ocean', 8),
      },
      {
        name:     'Portraits',
        color:    '#e91e8c',
        position: new THREE.Vector3(0, 2.7, -38),
        photos:   this._photos('portraits', 8),
      },
      {
        name:     'Cities',
        color:    '#ff6b35',
        position: new THREE.Vector3(-30, 2.7, -52),
        photos:   this._photos('cities', 8),
      },
      {
        name:     'Forest',
        color:    '#4caf50',
        position: new THREE.Vector3(30, 2.7, -48),
        photos:   this._photos('forest', 8),
      },
    ];

    for (const d of defs) {
      // Portal faces toward the player starting area (0,0,18)
      const toOrigin  = new THREE.Vector3(0, 0, 18).sub(d.position);
      const facingY   = Math.atan2(toOrigin.x, toOrigin.z);

      const portal = new Portal({ ...d, facingY });
      this.portals.push(portal);
      this.sm.scene.add(portal.group);
    }
  }

  /** Picsum placeholder photos. Replace with real paths in production. */
  _photos(seed, count) {
    return Array.from({ length: count }, (_, i) => ({
      url:     `https://picsum.photos/seed/${seed}${i + 1}/800/600`,
      caption: `${seed} — ${String(i + 1).padStart(2, '0')}`,
    }));
  }

  // ─── Main update (called every frame) ────────────────────────────────────

  update(t) {
    if (this.state !== 'explore') return;

    this._followCamera();
    this._checkProximity(t);
    this._handleInput();

    this.sm.update();
  }

  // ─── Camera follow ───────────────────────────────────────────────────────

  _followCamera() {
    const pp = this.player.position;
    const target = new THREE.Vector3(
      pp.x + this._camOffset.x,
      pp.y + this._camOffset.y,
      pp.z + this._camOffset.z
    );
    this.sm.camera.position.lerp(target, this._camLerpSpeed);
    this.sm.camera.lookAt(pp.x, pp.y + 1.0, pp.z);
  }

  // ─── Proximity detection ─────────────────────────────────────────────────

  _checkProximity(t) {
    const pp          = this.player.position;
    const GLOW_DIST   = 22;
    const ENTRY_DIST  = 9;

    let nearest = null, nearestDist = Infinity;

    for (const portal of this.portals) {
      const d = portal.distanceXZ(pp);
      const proximity = THREE.MathUtils.clamp(
        1 - (d - ENTRY_DIST) / (GLOW_DIST - ENTRY_DIST), 0, 1
      );
      portal.update(t, proximity);

      if (d < GLOW_DIST && d < nearestDist) {
        nearestDist = d;
        nearest     = portal;
      }
    }

    if (nearest && nearestDist < GLOW_DIST) {
      this.nearPortal = nearest;
      this._nameEl.textContent = nearest.name;
      document.documentElement.style.setProperty('--portal-col', nearest.color.getStyle());
      this._labelEl.classList.add('visible');
    } else {
      this.nearPortal = null;
      this._labelEl.classList.remove('visible');
    }
  }

  // ─── Input ───────────────────────────────────────────────────────────────

  _handleInput() {
    if (this.controls.keys.interact && this.nearPortal) {
      this.controls.consumeInteract();
      this._openGallery(this.nearPortal);
    }
    if (this.controls.keys.escape) {
      this.controls.consumeEscape();
    }
  }

  // ─── Gallery ─────────────────────────────────────────────────────────────

  _openGallery(portal) {
    this.state = 'gallery';
    this.player.setMovable(false);

    // Populate grid
    this._categoryEl.textContent = portal.name.toUpperCase();
    this._gridEl.innerHTML = '';

    for (const photo of portal.photos) {
      const item = document.createElement('div');
      item.className = 'gallery-item';

      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.caption;
      img.loading = 'lazy';

      const cap = document.createElement('span');
      cap.className = 'gallery-caption';
      cap.textContent = photo.caption;

      item.appendChild(img);
      item.appendChild(cap);
      item.addEventListener('click', () => this._openLightbox(photo));
      this._gridEl.appendChild(item);
    }

    // Show overlay (CSS slide-up transition)
    this._galleryEl.classList.remove('hidden');
    // Force reflow so transition fires
    void this._galleryEl.offsetHeight;
    this._galleryEl.classList.add('visible');
    document.body.style.cursor = 'default';
  }

  _closeGallery() {
    this._galleryEl.classList.remove('visible');
    this._lightboxEl.classList.add('hidden');

    // Wait for CSS slide-down transition to finish
    const onEnd = () => {
      this._galleryEl.classList.add('hidden');
      this._galleryEl.removeEventListener('transitionend', onEnd);
      this.state = 'explore';
      this.player.setMovable(true);
      document.body.style.cursor = 'none';
    };
    this._galleryEl.addEventListener('transitionend', onEnd);
  }

  _openLightbox(photo) {
    document.getElementById('lightbox-img').src         = photo.url;
    document.getElementById('lightbox-caption').textContent = photo.caption;
    this._lightboxEl.classList.remove('hidden');
  }
}
