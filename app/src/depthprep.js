// Conditions a raw depth-map bitmap for use as a mesh displacement field.
//
// Convention: red channel, 255 = nearest (inverse depth / disparity), which is
// what MiDaS / Depth-Anything style models emit.
//
// Three passes, in order:
//   1. Downscale to DEPTH_MAX_W. A displacement field does not need colour
//      resolution, and every filter below is O(px).
//   2. Asymmetric gradient clamp — dilate near values outward, then blur. A
//      one-texel depth cliff becomes a short ramp, so the disocclusion behind a
//      silhouette gets covered by stretched background instead of opening a
//      hole. Direction matters: near grows into far, never the reverse, or
//      every object gets a halo of background-depth and reads as a cutout.
//   3. Flatten the pole rows to their row mean. The sphere's pole fan has many
//      vertices sharing v=0, and if they disagree on radius the fan tears.

export const DEPTH_MAX_W = 2048;

const DILATE = 3;  // px the foreground grows into the background
const BLUR = 4;    // px box-blur radius, applied after the dilate

export function prepareDepth(bitmap) {
  let w = bitmap.width;
  let h = bitmap.height;
  if (w > DEPTH_MAX_W) {
    h = Math.max(1, Math.round(h * (DEPTH_MAX_W / w)));
    w = DEPTH_MAX_W;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);

  const img = ctx.getImageData(0, 0, w, h);
  let buf = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) buf[p] = img.data[i];

  let tmp = new Uint8Array(w * h);
  maxH(buf, tmp, w, h, DILATE);
  maxV(tmp, buf, w, h, DILATE);
  boxH(buf, tmp, w, h, BLUR);
  boxV(tmp, buf, w, h, BLUR);
  flattenPoles(buf, w, h);

  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = buf[p];
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Horizontal passes wrap: a panorama is continuous across the seam.
function maxH(src, dst, w, h, r) {
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = -r; k <= r; k++) {
        let xx = x + k;
        if (xx < 0) xx += w; else if (xx >= w) xx -= w;
        const v = src[row + xx];
        if (v > m) m = v;
      }
      dst[row + x] = m;
    }
  }
}

// Vertical passes clamp: top and bottom are poles, not neighbours.
function maxV(src, dst, w, h, r) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = -r; k <= r; k++) {
        let yy = y + k;
        if (yy < 0) yy = 0; else if (yy >= h) yy = h - 1;
        const v = src[yy * w + x];
        if (v > m) m = v;
      }
      dst[y * w + x] = m;
    }
  }
}

function boxH(src, dst, w, h, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) {
        let xx = x + k;
        if (xx < 0) xx += w; else if (xx >= w) xx -= w;
        sum += src[row + xx];
      }
      dst[row + x] = (sum / n) | 0;
    }
  }
}

function boxV(src, dst, w, h, r) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, n = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= h) continue;
        sum += src[yy * w + x];
        n++;
      }
      dst[y * w + x] = (sum / n) | 0;
    }
  }
}

function flattenPoles(buf, w, h) {
  for (const y of [0, h - 1]) {
    const row = y * w;
    let sum = 0;
    for (let x = 0; x < w; x++) sum += buf[row + x];
    const mean = (sum / w) | 0;
    for (let x = 0; x < w; x++) buf[row + x] = mean;
  }
}
