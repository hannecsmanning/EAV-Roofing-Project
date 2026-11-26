// Decoration for the world (Figma "References for Environment in the simulator"): grass tufts, flower clumps and
// trees around the edges, in a warm autumn palette. Low density, like Animal Crossing with fewer objects.
// None of these block the truck or trigger alerts. The obstacles that do (bushes and posts) are in Site.tsx.
import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { scene } from '../tokens/tokens'
import { ROOF_OUTLINE, OBSTACLES, MATERIAL_SPOT, BRANCH, groundHeight } from './siteLayout'
import { isInside, edgeDistance } from './roofShape'
import { toonGradient, seeded } from './look'

/** Distance from a point to a line segment, on the ground. */
function segDist(px: number, pz: number, a: { x: number; z: number }, b: { x: number; z: number }) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / (dx * dx + dz * dz)))
  return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz))
}

/** Keep decoration off the house, the wire, the material branch and spot, and away from the obstacles. */
function clear(x: number, z: number, roofGap: number) {
  if (isInside(ROOF_OUTLINE, x, z) || edgeDistance(ROOF_OUTLINE, x, z) < roofGap) return false
  if (segDist(x, z, BRANCH.start, BRANCH.end) < 3) return false
  const m = MATERIAL_SPOT
  if (Math.abs(x - m.x) < m.width / 2 + 3 && Math.abs(z - m.z) < m.depth / 2 + 3) return false
  return OBSTACLES.every((o) => Math.hypot(x - o.x, z - o.z) > o.radius + 1.2)
}

const Toon = ({ c }: { c: string }) => <meshToonMaterial color={c} gradientMap={toonGradient} />

// ---------- Grass tufts ----------
// A few short blades leaning out from a point, scattered thinly over the yard.
function Tufts() {
  const { geometry, matrices } = useMemo(() => {
    const blades: THREE.BufferGeometry[] = []
    for (let i = 0; i < 4; i++) {
      const b = new THREE.ConeGeometry(0.035, 0.32 + i * 0.04, 4)
      b.translate(0, (0.32 + i * 0.04) / 2, 0)
      b.rotateZ(0.25 * (i % 2 ? 1 : -1))
      b.rotateY((i * Math.PI) / 2 + 0.4)
      blades.push(b)
    }
    const geometry = mergeGeometries(blades)!
    const rand = seeded(11)
    const matrices: THREE.Matrix4[] = []
    for (let tries = 0; matrices.length < 260 && tries < 4000; tries++) {
      const x = -62 + rand() * 115
      const z = -64 + rand() * 100
      if (!clear(x, z, 3.5)) continue
      const s = 0.8 + rand() * 0.7
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, groundHeight(x, z), z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * Math.PI * 2, 0)),
        new THREE.Vector3(s, s, s),
      )
      matrices.push(m)
    }
    return { geometry, matrices }
  }, [])
  return (
    <instancedMesh
      args={[geometry, undefined, matrices.length]}
      ref={(m) => {
        if (!m) return
        matrices.forEach((mx, i) => m.setMatrixAt(i, mx))
        m.instanceMatrix.needsUpdate = true
      }}
      receiveShadow
    >
      <Toon c={scene.tuft} />
    </instancedMesh>
  )
}

// ---------- Flower clumps ----------
// Small round blooms over a few leaves, in a band around the house just past where the truck drives.
const FLOWER_COLORS = [scene.flowerYellow, scene.flowerCoral, scene.flowerWhite]
function Flowers() {
  const clumps = useMemo(() => {
    const rand = seeded(23)
    const out: { x: number; z: number; color: string; n: number }[] = []
    for (let tries = 0; out.length < 12 && tries < 3000; tries++) {
      const x = -40 + rand() * 75
      const z = -48 + rand() * 62
      const d = edgeDistance(ROOF_OUTLINE, x, z)
      if (d < 5 || d > 8 || !clear(x, z, 5)) continue
      if (out.some((c) => Math.hypot(c.x - x, c.z - z) < 7)) continue
      out.push({ x, z, color: FLOWER_COLORS[out.length % FLOWER_COLORS.length], n: 3 + Math.floor(rand() * 3) })
    }
    return out
  }, [])
  return (
    <>
      {clumps.map((c, i) => (
        <group key={i} position={[c.x, groundHeight(c.x, c.z), c.z]}>
          {Array.from({ length: c.n }, (_, k) => {
            const a = (k / c.n) * Math.PI * 2 + i
            const r = k === 0 ? 0 : 0.22
            return (
              <group key={k} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
                <mesh position={[0, 0.08, 0]} scale={[1.6, 0.5, 1.6]} castShadow>
                  <sphereGeometry args={[0.11, 10, 8]} />
                  <Toon c={scene.leaf} />
                </mesh>
                <mesh position={[0, 0.26, 0]} castShadow>
                  <sphereGeometry args={[0.09, 12, 10]} />
                  <Toon c={c.color} />
                </mesh>
              </group>
            )
          })}
        </group>
      ))}
    </>
  )
}

// ---------- Trees around the edges ----------
// Round trees with a thick, flared trunk and a puffy canopy, plus a few pines. Placed outside the area the
// truck works in, so they frame the site without getting in the way.
type Tree = { x: number; z: number; kind: 'round' | 'pine'; color?: string; s: number }
const TREES: Tree[] = [
  { x: -64, z: -40, kind: 'pine', s: 1.2 },
  { x: -66, z: -18, kind: 'round', color: scene.treeOrange, s: 1.1 },
  { x: -62, z: 6, kind: 'round', color: scene.treeGold, s: 1 },
  { x: -48, z: 26, kind: 'pine', s: 1 },
  { x: -30, z: 34, kind: 'round', color: scene.treeRust, s: 1.15 },
  { x: -8, z: 38, kind: 'round', color: scene.treeGold, s: 1.05 },
  { x: 14, z: 35, kind: 'pine', s: 1.1 },
  { x: 36, z: 30, kind: 'round', color: scene.treeOrange, s: 1.2 },
  { x: 54, z: 12, kind: 'round', color: scene.treeGold, s: 1 },
  { x: 60, z: -12, kind: 'pine', s: 1.25 },
  { x: 58, z: -44, kind: 'round', color: scene.treeRust, s: 1.1 },
  { x: 34, z: -62, kind: 'round', color: scene.treeOrange, s: 1 },
  { x: 8, z: -66, kind: 'pine', s: 1.15 },
  { x: -18, z: -64, kind: 'round', color: scene.treeGold, s: 1.2 },
  { x: -44, z: -60, kind: 'round', color: scene.treeOrange, s: 1.05 },
]

function RoundTree({ t }: { t: Tree }) {
  return (
    <group position={[t.x, groundHeight(t.x, t.z), t.z]} scale={t.s}>
      {/* Trunk, flared at the base like the reference */}
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.38, 0.55, 2.4, 10]} />
        <Toon c={scene.trunk} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.85, 0.4, 10]} />
        <Toon c={scene.trunk} />
      </mesh>
      {/* Puffy canopy */}
      {[
        [0, 3.6, 0, 1.9],
        [1.1, 3.1, 0.4, 1.3],
        [-1.0, 3.2, -0.3, 1.35],
        [0.2, 4.6, -0.2, 1.3],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
          <icosahedronGeometry args={[r, 2]} />
          <Toon c={t.color!} />
        </mesh>
      ))}
    </group>
  )
}

function Pine({ t }: { t: Tree }) {
  return (
    <group position={[t.x, groundHeight(t.x, t.z), t.z]} scale={t.s}>
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.45, 1.6, 10]} />
        <Toon c={scene.trunk} />
      </mesh>
      {[
        [1.9, 2.0, 2.2],
        [1.5, 3.2, 1.9],
        [1.05, 4.3, 1.6],
      ].map(([r, y, h], i) => (
        <mesh key={i} position={[0, y, 0]} castShadow receiveShadow>
          <coneGeometry args={[r, h, 12]} />
          <Toon c={i % 2 ? scene.pineDark : scene.pine} />
        </mesh>
      ))}
    </group>
  )
}

export function Nature() {
  return (
    <>
      <Tufts />
      <Flowers />
      {TREES.map((t, i) => (t.kind === 'round' ? <RoundTree key={i} t={t} /> : <Pine key={i} t={t} />))}
    </>
  )
}
