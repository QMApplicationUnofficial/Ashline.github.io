export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseButtons = new Set();
    this.pointerLocked = false;
    this.deltaX = 0;
    this.deltaY = 0;
    this.scrollDelta = 0;
    this.events = new Map();

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handlePointerLock = this.handlePointerLock.bind(this);

    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('wheel', this.handleWheel, { passive: true });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('pointerlockchange', this.handlePointerLock);
  }

  handleKeyDown(event) {
    if (event.target?.matches?.('input, select, textarea, button')) return;
    if (!this.keys.has(event.code)) {
      this.events.set(event.code, true);
    }
    this.keys.add(event.code);
  }

  handleKeyUp(event) {
    this.keys.delete(event.code);
  }

  handleMouseMove(event) {
    if (!this.pointerLocked) return;
    this.deltaX += event.movementX;
    this.deltaY += event.movementY;
  }

  handleMouseDown(event) {
    this.mouseButtons.add(event.button);
  }

  handleMouseUp(event) {
    this.mouseButtons.delete(event.button);
  }

  handleWheel(event) {
    this.scrollDelta += Math.sign(event.deltaY);
  }

  handlePointerLock() {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  }

  requestPointerLock() {
    this.canvas.requestPointerLock?.();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  mouseDown(button = 0) {
    return this.mouseButtons.has(button);
  }

  consume(code) {
    const value = this.events.has(code);
    this.events.delete(code);
    return value;
  }

  consumeMouseDelta() {
    const value = { x: this.deltaX, y: this.deltaY };
    this.deltaX = 0;
    this.deltaY = 0;
    return value;
  }

  consumeScroll() {
    const value = this.scrollDelta;
    this.scrollDelta = 0;
    return value;
  }
}
