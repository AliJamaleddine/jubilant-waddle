/**
 * main.js — Entry point. Wires modules, runs the loop.
 */
(function () {
  'use strict';

  let sm, controls, player, universe, clock;

  function init() {
    const canvas = document.getElementById('canvas');

    clock    = new THREE.Clock();
    controls = new Controls();
    sm       = new SceneManager(canvas);
    player   = new Player(sm.scene, controls);
    universe = new Universe(sm, player, controls);

    // Add lights (created in SceneManager, added here)
    sm.scene.add(sm.ambientLight);
    sm.scene.add(sm.dirLight);

    requestAnimationFrame(loop);
    setTimeout(hideLoader, 600);
  }

  function hideLoader() {
    const loader = document.getElementById('loader');
    loader.classList.add('fade-out');
    setTimeout(() => { loader.style.display = 'none'; }, 700);
  }

  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t  = clock.getElapsedTime();

    // Player always animates; movement gated by player.movable internally
    player.update(dt, t, sm.camera);

    // Universe handles portals + camera (skips if in gallery state)
    universe.update(t);

    sm.render();

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
