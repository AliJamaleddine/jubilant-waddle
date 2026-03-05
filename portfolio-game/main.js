/**
 * main.js — Entry point.
 * Wires all modules together and runs the game loop.
 */

(function () {
  'use strict';

  const canvas = document.getElementById('canvas');
  const loader = document.getElementById('loader');

  let sceneManager, controls, player, universe, clock;

  function init() {
    clock        = new THREE.Clock();
    controls     = new Controls();
    sceneManager = new SceneManager(canvas);
    player       = new Player(sceneManager.scene, controls);
    universe     = new Universe(sceneManager, player, controls);

    // Add lights (defined in SceneManager but added to scene here)
    sceneManager.scene.add(sceneManager.ambientLight);
    sceneManager.scene.add(sceneManager.dirLight);

    requestAnimationFrame(loop);

    // Small delay so WebGL finishes first frame before fading loader
    setTimeout(hideLoader, 700);
  }

  function hideLoader() {
    loader.classList.add('fade-out');
    setTimeout(() => { loader.style.display = 'none'; }, 800);
  }

  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t  = clock.getElapsedTime();

    // Only update player movement when in space (not inside a galaxy)
    // player.movable flag handles this internally, but we always call
    // update so the float animation keeps running
    player.update(dt, t, sceneManager.camera);

    universe.update(dt, t);

    sceneManager.render(sceneManager.scene);

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
