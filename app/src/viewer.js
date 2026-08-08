import * as THREE from 'three';

// Sphere radius, and the radius the farthest depth (sky) maps to.
const FAR_R = 500;
// Nearest surface as a fraction of FAR_R. This is the depth "strength" knob:
// the map is relative inverse depth with no metric scale, so there is nothing
// to derive it from — it's tuned by eye per image.
const DEFAULT_NEAR_RATIO = 0.12;
// Eye travel budget as a fraction of the nearest surface. Must stay well under
// 1.0: reach the nearest surface and the camera punches through the mesh and
// sees the panorama inside-out.
const EYE_FRACTION = 0.15;

// Enough segments that the displacement field isn't the limiting factor.
const SEG_W = 512;
const SEG_H = 256;

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

    // A 1x1 white map is always bound so USE_MAP (and with it the uv attribute
    // the displacement needs) is defined even before an image is loaded.
    this._white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    this._white.needsUpdate = true;

    this.depthUniforms = {
      depthMap: { value: this._white },
      uHasDepth: { value: 0 },
      uNearR: { value: FAR_R * DEFAULT_NEAR_RATIO },
      uFarR: { value: FAR_R },
    };

    const geom = new THREE.SphereGeometry(FAR_R, SEG_W, SEG_H);
    geom.scale(-1, 1, 1);
    this.material = new THREE.MeshBasicMaterial({ map: this._white, color: 0x101010 });
    this.material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, this.depthUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
        uniform sampler2D depthMap;
        uniform float uHasDepth;
        uniform float uNearR;
        uniform float uFarR;`)
        .replace('#include <begin_vertex>', `
        vec3 transformed = vec3( position );
        if ( uHasDepth > 0.5 ) {
          // Disparity is linear in 1/r, so interpolate the reciprocal — that is
          // what makes a relative depth map land in roughly the right places.
          float d = texture2D( depthMap, uv ).r;
          float invR = mix( 1.0 / uFarR, 1.0 / uNearR, d );
          transformed = normalize( position ) * ( 1.0 / max( invR, 1e-6 ) );
        }`);
    };
    this.sphere = new THREE.Mesh(geom, this.material);
    this.scene.add(this.sphere);

    // View state — these never reset across image changes
    this.yaw = 0;
    this.pitch = 0;
    this.fov = 75;
    this.eye = new THREE.Vector3();

    this.texture = null;
    this.depthTexture = null;
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

  setDepthCanvas(canvas) {
    if (!canvas) { this.clearDepth(); return; }
    const sameCanvas = this.depthTexture && this.depthTexture.image === canvas;
    const sameSize = sameCanvas && this._lastDW === canvas.width && this._lastDH === canvas.height;
    if (sameSize) {
      this.depthTexture.needsUpdate = true;
      return;
    }
    if (this.depthTexture) this.depthTexture.dispose();
    this.depthTexture = new THREE.CanvasTexture(canvas);
    // Raw values, not colour — no sRGB decode, no mipmaps (a mip of a depth
    // cliff averages near and far into a surface that exists nowhere).
    this.depthTexture.colorSpace = THREE.NoColorSpace;
    this.depthTexture.wrapS = THREE.RepeatWrapping;
    this.depthTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.depthTexture.minFilter = THREE.LinearFilter;
    this.depthTexture.magFilter = THREE.LinearFilter;
    this.depthTexture.generateMipmaps = false;
    this.depthUniforms.depthMap.value = this.depthTexture;
    this.depthUniforms.uHasDepth.value = 1;
    this._lastDW = canvas.width;
    this._lastDH = canvas.height;
  }

  clearDepth() {
    if (this.depthTexture) {
      this.depthTexture.dispose();
      this.depthTexture = null;
    }
    this.depthUniforms.depthMap.value = this._white;
    this.depthUniforms.uHasDepth.value = 0;
    this.setEyeOffset(0, 0, 0);
  }

  hasDepth() { return this.depthUniforms.uHasDepth.value > 0.5; }

  markTextureDirty() {
    if (this.texture) this.texture.needsUpdate = true;
    if (this.depthTexture) this.depthTexture.needsUpdate = true;
  }

  clearTexture() {
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
    this.material.map = this._white;
    this.material.color.setHex(0x101010);
    this.material.needsUpdate = true;
    this.clearDepth();
  }

  getNearRatio() { return this.depthUniforms.uNearR.value / FAR_R; }

  setNearRatio(ratio) {
    const r = Math.max(0.03, Math.min(0.6, ratio));
    this.depthUniforms.uNearR.value = FAR_R * r;
    return r;
  }

  eyeLimit() { return this.depthUniforms.uNearR.value * EYE_FRACTION; }

  setEyeOffset(x, y, z) { this.eye.set(x, y, z); }

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
    this.camera.position.copy(this.eye);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._tick);
  }
}
