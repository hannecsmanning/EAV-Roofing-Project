// The world's toy-like look (Figma "References for Environment in the simulator"): soft stepped shading on the
// ground, plants and house, and the faint triangle pattern Animal Crossing puts on its grass. The truck keeps its
// regular shading.
import * as THREE from 'three'
import { scene } from '../tokens/tokens'

/** Soft stepped light for MeshToonMaterial: shadowed side, middle, lit side. Close steps, so it stays gentle. */
export const toonGradient = (() => {
  const steps = [178, 215, 242, 255]
  const t = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat)
  t.minFilter = THREE.NearestFilter
  t.magFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
})()

/** The roof's own light steps: stronger than the rest, so faces turned away from the sun read clearly darker.
 *  The roof is shallow, so its faces only use the brighter half of the range: the steps are fine-grained there,
 *  giving each face direction (toward the sun, away, and the two sides) its own shade. */
export const roofGradient = (() => {
  const steps = [90, 100, 110, 120, 140, 170, 215, 255]
  const t = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat)
  t.minFilter = THREE.NearestFilter
  t.magFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
})()

/** A small seeded random, so the scattered details land in the same spots every time. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The grass pattern: small soft triangles scattered on white, repeated across the ground (it multiplies the grass color). */
export const grassPattern = (() => {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, size, size)
  g.fillStyle = scene.grassStamp
  const rand = seeded(7)
  for (let i = 0; i < 26; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 5 + rand() * 4
    const a = rand() * Math.PI * 2
    // Draw each triangle at the edges too, so the tile repeats without seams.
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      g.beginPath()
      for (let k = 0; k < 3; k++) {
        const t = a + (k * Math.PI * 2) / 3
        const px = x + ox + Math.cos(t) * r
        const py = y + oy + Math.sin(t) * r
        if (k === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      }
      g.closePath()
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
})()

/** The sky: hazy blue overhead fading to a warm haze at the horizon. Used as the scene background. */
export const skyGradient = (() => {
  const c = document.createElement('canvas')
  c.width = 2
  c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, scene.sky)
  grad.addColorStop(0.75, scene.skyHorizon)
  grad.addColorStop(1, scene.skyHorizon)
  g.fillStyle = grad
  g.fillRect(0, 0, 2, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()

/** How much roof one shingle texture tile covers, in meters (8 rows of shingles, 8 tabs across). */
export const SHINGLE_TILE_M = 2.4

/**
 * Shingles: rows of tabs with staggered gaps, a dark line under each row and a little variation from tab to tab.
 * White-ish, so it multiplies the roof color. u runs along the eave, v runs up the slope.
 */
export const shinglePattern = (() => {
  const size = 256
  const rows = 8
  const tabs = 8
  const rh = size / rows
  const tw = size / tabs
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const rand = seeded(5)
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 ? tw / 2 : 0
    for (let k = -1; k <= tabs; k++) {
      // Each tab a slightly different shade, lighter toward its bottom edge.
      const shade = 225 + Math.floor(rand() * 30)
      const x = k * tw + offset
      const grad = g.createLinearGradient(0, r * rh, 0, (r + 1) * rh)
      grad.addColorStop(0, `rgb(${shade - 25},${shade - 25},${shade - 25})`)
      grad.addColorStop(1, `rgb(${shade},${shade},${shade})`)
      g.fillStyle = grad
      g.fillRect(x, r * rh, tw, rh)
      // The gap between tabs
      g.fillStyle = 'rgb(150,150,150)'
      g.fillRect(x, r * rh, 2, rh)
    }
    // The shadow line along the bottom of each row (rows overlap the one below)
    g.fillStyle = 'rgb(130,130,130)'
    g.fillRect(0, (r + 1) * rh - 3, size, 3)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
})()
