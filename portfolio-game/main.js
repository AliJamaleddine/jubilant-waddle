/**
 * main.js
 * Entry point — wires everything together and runs the game loop.
 */

(function () {
  'use strict';

  // ─── Init ─────────────────────────────────────────────────────────────

  const canvas   = document.getElementById('canvas');
  const loader   = document.getElementById('loader');

  let sceneManager, controls, player, universe;
  let clock, running = false;

  function init() {
    clock        = new THREE.Clock();
    controls     = new Controls();
    sceneManager = new SceneManager(canvas);
    player       = new Player(sceneManager.scene, controls);
    universe     = new Universe(sceneManager, player, controls);

    // Add lights to scene
    sceneManager.scene.add(sceneManager.ambientLight);
    sceneManager.scene.add(sceneManager.dirLight);

    // Kick off
    running = true;
    requestAnimationFrame(loop);

    // Hide loader after a short beat to let WebGL warm up
    setTimeout(hideLoader, 800);
  }

  function hideLoader() {
    loader.classList.add('fade-out');
    setTimeout(() => { loader.style.display = 'none'; }, 900);
  }

  // ─── Main loop ───────────────────────────────────────────────────────

  function loop() {
    if (!running) return;

    const dt = Math.min(clock.getDelta(), 0.05); // cap at 50ms for safety
    const t  = clock.getElapsedTime();

    // Update player
    player.update(dt, t, sceneManager.camera);

    // Update universe (galaxies, camera follow, interactions)
    universe.update(dt, t);

    // Render
    sceneManager.render(sceneManager.scene);

    requestAnimationFrame(loop);
  }

  // ─── Start ────────────────────────────────────────────────────────────

  // THREE.js is loaded synchronously from CDN; start once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
