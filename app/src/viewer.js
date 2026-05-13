import * as THREE from 'three';

export class Viewer {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1100);
    this.camera.rotation.order = 'YXZ';

    const geom = new THREE.SphereGeometry(500, 96, 48);
    geom.scale(-1, 1, 1);
    this.material = new THREE.MeshBasicMaterial({ map: null, color: 0x101010 });
    this.sphere = new THREE.Mesh(geom, this.material);
    this.scene.add(this.sphere);

    // View state — these never reset across image changes
    this.yaw = 0;
    this.pitch = 0;
    this.fov = 75;

    this.texture = null;
    this.maxTextureSize = this.renderer.capabilities.maxTextureSize;

    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);

    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setSourceCanvas(canvas) {
    const sameCanvas = this.texture && this.texture.image === canvas;
    const sameSize = sameCanvas && this._lastW === canvas.width && this._lastH === canvas.height;
    if (sameSize) {
      this.texture.needsUpdate = true;
      return;
    }
    if (this.texture) this.texture.dispose();
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.material.map = this.texture;
    this.material.color.setHex(0xffffff);
    this.material.needsUpdate = true;
    this._lastW = canvas.width;
    this._lastH = canvas.height;
  }

  markTextureDirty() {
    if (this.texture) this.texture.needsUpdate = true;
  }

  clearTexture() {
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
    this.material.map = null;
    this.material.color.setHex(0x101010);
    this.material.needsUpdate = true;
  }

  setFov(fov) {
    this.fov = Math.max(20, Math.min(110, fov));
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }

  setYaw(yaw) { this.yaw = yaw; }

  setPitch(pitch) {
    const lim = Math.PI / 2 - 0.001;
    this.pitch = Math.max(-lim, Math.min(lim, pitch));
  }

  rotate(dyaw, dpitch) {
    this.setYaw(this.yaw + dyaw);
    this.setPitch(this.pitch + dpitch);
  }

  zoomFov(delta) { this.setFov(this.fov + delta); }

  getHeadingDegrees() {
    let deg = -(this.yaw * 180 / Math.PI);
    deg = ((deg % 360) + 360) % 360;
    return deg;
  }

  resetHeading() { this.yaw = 0; }

  _tick() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._tick);
  }
}
