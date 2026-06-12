const DEG_TO_RAD = Math.PI / 180;

export class AutoRotate {
  constructor(viewer, {
    defaultSpeedDeg = 10,
    stepDeg = 1,
    fineStepDeg = 0.1,
    maxSpeedDeg = 60,
  } = {}) {
    this.viewer = viewer;
    this.enabled = false;
    this.speedDeg = defaultSpeedDeg;
    this.stepDeg = stepDeg;
    this.fineStepDeg = fineStepDeg;
    this.maxSpeedDeg = maxSpeedDeg;
    this.direction = 1;
    this._lastFrame = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - this._lastFrame) / 1000);
      this._lastFrame = now;

      if (this.enabled && this.speedDeg > 0) {
        this.viewer.rotate(this.direction * this.speedDeg * DEG_TO_RAD * dt, 0);
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  increaseSpeed(step = this.stepDeg) {
    this.speedDeg = this._clampSpeed(this.speedDeg + step);
  }

  decreaseSpeed(step = this.stepDeg) {
    this.speedDeg = this._clampSpeed(this.speedDeg - step);
  }

  flipDirection() {
    this.direction *= -1;
  }

  directionLabel() {
    return this.direction > 0 ? 'CW' : 'CCW';
  }

  fineStep() {
    return this.fineStepDeg;
  }

  _clampSpeed(speed) {
    const clamped = Math.max(0, Math.min(this.maxSpeedDeg, speed));
    return Math.round(clamped * 10) / 10;
  }

  _speedLabel() {
    return Number.isInteger(this.speedDeg) ? `${this.speedDeg}` : this.speedDeg.toFixed(1);
  }

  statusLabel() {
    if (!this.enabled) return 'Auto-rotate off';
    if (this.speedDeg === 0) return `Auto-rotate paused (${this.directionLabel()})`;
    return `Auto-rotate: ${this.directionLabel()} ${this._speedLabel()} deg/s`;
  }
}
