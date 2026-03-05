/**
 * controls.js
 * Manages keyboard input state.
 * Consumed by Player to compute movement each frame.
 */

class Controls {
  constructor() {
    // Key state map
    this.keys = {
      forward:  false,  // W / ArrowUp
      backward: false,  // S / ArrowDown
      left:     false,  // A / ArrowLeft
      right:    false,  // D / ArrowRight
      interact: false,  // E (single-press, auto-cleared after read)
      escape:   false,  // Escape
    };

    this._interactConsumed = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
  }

  _onKeyDown(e) {
    switch (e.code) {
      case 'KeyW':     case 'ArrowUp':    this.keys.forward   = true;  break;
      case 'KeyS':     case 'ArrowDown':  this.keys.backward  = true;  break;
      case 'KeyA':     case 'ArrowLeft':  this.keys.left      = true;  break;
      case 'KeyD':     case 'ArrowRight': this.keys.right     = true;  break;
      case 'KeyE':
        if (!this._interactConsumed) {
          this.keys.interact = true;
          this._interactConsumed = true;
        }
        break;
      case 'Escape':
        this.keys.escape = true;
        break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW':     case 'ArrowUp':    this.keys.forward   = false; break;
      case 'KeyS':     case 'ArrowDown':  this.keys.backward  = false; break;
      case 'KeyA':     case 'ArrowLeft':  this.keys.left      = false; break;
      case 'KeyD':     case 'ArrowRight': this.keys.right     = false; break;
      case 'KeyE':
        this._interactConsumed = false;
        break;
      case 'Escape':
        this.keys.escape = false;
        break;
    }
  }

  /**
   * Call once per frame after reading interact.
   * Prevents holding E from triggering repeatedly.
   */
  consumeInteract() {
    this.keys.interact = false;
  }

  /**
   * Consume escape (one-shot read)
   */
  consumeEscape() {
    this.keys.escape = false;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
  }
}
