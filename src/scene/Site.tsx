import { useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { color, scene, space, radius, font } from '../tokens/tokens'
import {
  HOUSE, ROOF_OUTLINE, WALL_OUTLINE, OBSTACLES, MATERIAL_SPOT, LOADS, MAX_LOAD_LB,
  groundHeight, type Obstacle, type Load,
} from './siteLayout'
import { isInside, squareDistance } from './roofShape'
import { useSim } from '../store'
import { toonGradient, roofGradient, grassPattern, shinglePattern, sidingPattern, SHINGLE_TILE_M } from './look'
import { HouseDetails } from './HouseDetails'
import { Nature } from './Nature'

// Step 1 of the Simulator plan: the 3D map. Simple shapes, in a soft toy-like autumn look (look.ts, Nature.tsx).

const Toon = ({ c, ...rest }: { c: string } & Partial<THREE.MeshToonMaterialParameters>) => (
  <meshToonMaterial color={c} gradientMap={toonGradient} {...rest} />
)

// ---------- Ground with the steep slope ----------
function Ground() {
  const geometry = useMemo(() => {
    const size = 200
    const g = new THREE.PlaneGeometry(size, size, 200, 200)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors: number[] = []
    const flat = new THREE.Color(scene.grass)
    const steep = new THREE.Color(scene.grassSlope)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const y = groundHeight(x, z)
      pos.setY(i, y)
      // Tint the bank a little darker so it reads as a slope.
      const c = Math.abs(y) > 0.05 ? steep : flat
      colors.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])

  // The faint triangle pattern repeats about every 4 m.
  const pattern = useMemo(() => {
    const t = grassPattern.clone()
    t.repeat.set(50, 50)
    t.needsUpdate = true
    return t
  }, [])
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshToonMaterial vertexColors map={pattern} gradientMap={toonGradient} />
    </mesh>
  )
}

// ---------- House ----------
// Walls follow the Figma roof shape, pulled in by the overhang. The roof is a hip roof:
// every edge slopes up at the same angle, meeting in hips, valleys and ridges.
const ROOF_GRID = 0.25 // meters, matches how the outline corners are snapped

function buildRoof(top: boolean) {
  const xs = ROOF_OUTLINE.map((p) => p[0])
  const zs = ROOF_OUTLINE.map((p) => p[1])
  const x0 = Math.min(...xs)
  const z0 = Math.min(...zs)
  const cols = Math.round((Math.max(...xs) - x0) / ROOF_GRID)
  const rows = Math.round((Math.max(...zs) - z0) / ROOF_GRID)
  const slope = Math.tan((HOUSE.pitchDeg * Math.PI) / 180)
  const heightAt = (x: number, z: number) => (top ? squareDistance(ROOF_OUTLINE, x, z) * slope : 0)

  const positions: number[] = []
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const x = x0 + c * ROOF_GRID
      const z = z0 + r * ROOF_GRID
      positions.push(x, heightAt(x, z), z)
    }
  }
  const id = (c: number, r: number) => r * (cols + 1) + c
  const indices: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x0 + (c + 0.5) * ROOF_GRID
      const cz = z0 + (r + 0.5) * ROOF_GRID
      if (!isInside(ROOF_OUTLINE, cx, cz)) continue
      const [p00, p10, p01, p11] = [id(c, r), id(c + 1, r), id(c, r + 1), id(c + 1, r + 1)]
      // Split the square along whichever diagonal follows the roof better, so hips and valleys stay crisp.
      const h = (i: number) => positions[i * 3 + 1]
      const mid = heightAt(cx, cz)
      const useMain = Math.abs((h(p00) + h(p11)) / 2 - mid) <= Math.abs((h(p10) + h(p01)) / 2 - mid)
      const tris = useMain ? [p00, p01, p11, p00, p11, p10] : [p00, p01, p10, p10, p01, p11]
      // The underside faces down, so flip its triangles.
      if (!top) for (let t = 0; t < tris.length; t += 3) [tris[t + 1], tris[t + 2]] = [tris[t + 2], tris[t + 1]]
      indices.push(...tris)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  if (!top) {
    g.computeVertexNormals()
    return g
  }
  // The top: every triangle gets its own corners, so each roof face is shaded flat (crisp hips and valleys), and
  // shingle UVs that run along the eave (u) and up the slope (v) for whichever way that face slopes.
  const flat = g.toNonIndexed()
  flat.computeVertexNormals()
  const p = flat.attributes.position
  const n = flat.attributes.normal
  const uv: number[] = []
  const up = 1 / Math.cos((HOUSE.pitchDeg * Math.PI) / 180) // meters along the slope per meter across the ground
  for (let i = 0; i < p.count; i++) {
    const nx = n.getX(i)
    const nz = n.getZ(i)
    const x = p.getX(i)
    const z = p.getZ(i)
    // A face sloping down toward ±z has its eave along x; toward ±x, along z.
    const alongX = Math.abs(nz) >= Math.abs(nx)
    const u = alongX ? x : z
    const v = (alongX ? z * Math.sign(nz || 1) : x * Math.sign(nx || 1)) * up
    uv.push(u / SHINGLE_TILE_M, -v / SHINGLE_TILE_M)
  }
  flat.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return flat
}

function House() {
  const walls = useMemo(() => {
    // Shape is drawn flat, then stood up: shape y = -z, extruded upward by the wall height.
    const shape = new THREE.Shape(WALL_OUTLINE.map(([x, z]) => new THREE.Vector2(x, -z)))
    const g = new THREE.ExtrudeGeometry(shape, { depth: HOUSE.wallHeight, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
  const roof = useMemo(() => buildRoof(true), [])
  const soffit = useMemo(() => buildRoof(false), [])

  // The front door wall: the frontmost wall side.
  const frontZ = Math.max(...WALL_OUTLINE.map((p) => p[1])) + 0.02
  return (
    <group>
      {/* Walls with faint horizontal siding lines */}
      <mesh geometry={walls} castShadow receiveShadow>
        <Toon c={scene.wall} map={sidingPattern} />
      </mesh>
      <group position={[0, HOUSE.wallHeight, 0]}>
        {/* Shingled roof, with stronger light steps so the faces away from the sun read darker */}
        <mesh geometry={roof} castShadow receiveShadow>
          <meshToonMaterial color={scene.roof} map={shinglePattern} gradientMap={roofGradient} />
        </mesh>
        <mesh geometry={soffit}>
          <Toon c={scene.trim} />
        </mesh>
      </group>
      {/* Front door, with its frame and a step. Windows, trim, gutters, the porch, the garage and the roof items are in HouseDetails. */}
      <group position={[0, 0, frontZ]}>
        {/* Door with its frame and a low step */}
        <mesh position={[0, 1.12, 0.01]}>
          <boxGeometry args={[1.3, 2.35, 0.06]} />
          <Toon c={scene.trim} />
        </mesh>
        <mesh position={[0, 1.05, 0.05]}>
          <boxGeometry args={[1, 2.1, 0.04]} />
          <Toon c={scene.door} />
        </mesh>
        <mesh position={[0.32, 1.05, 0.09]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <Toon c={scene.trim} />
        </mesh>
        <mesh position={[0, 0.06, 0.3]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.12, 0.6]} />
          <Toon c={scene.trim} />
        </mesh>
      </group>
    </group>
  )
}

// ---------- Wire ----------
// The wire isn't drawn in the 3D world (Hanne, 2026-11-26). Its path is still there: the truck connects to it and rides
// it the same way (siteLayout wirePath, wireTrack), and the HMI maps still show it.

// ---------- Bushes and posts ----------
// Fixed lump offsets so every bush looks the same on each reload.
const LUMPS: [number, number, number, number][] = [
  [0, 0.55, 0, 0.75],
  [0.5, 0.4, 0.25, 0.6],
  [-0.45, 0.42, 0.3, 0.58],
  [0.1, 0.4, -0.5, 0.6],
  [-0.2, 0.85, -0.1, 0.5],
]

// Chunky, rounded clumps (smooth, not faceted), in muted autumn olive. Same size and spot as before: they're the
// obstacles the heat map and Object detection use.
function Bush({ o }: { o: Obstacle }) {
  const y = groundHeight(o.x, o.z)
  const s = o.radius
  const h = o.height / 1.35 // lumps stack to about 1.35 x radius tall
  return (
    <group position={[o.x, y, o.z]} scale={[s, h, s]}>
      {LUMPS.map(([x, ly, z, r], i) => (
        <mesh key={i} position={[x, ly, z]} castShadow receiveShadow>
          <icosahedronGeometry args={[r * 1.05, 3]} />
          <Toon c={i % 2 ? scene.bushDark : scene.bush} />
        </mesh>
      ))}
    </group>
  )
}

// Wooden posts with a rounded cap. The mailbox post carries a little mailbox, the lamp post a lamp.
// The post itself keeps its size, since that's what the truck can hit.
function Post({ o }: { o: Obstacle }) {
  const y = groundHeight(o.x, o.z)
  return (
    <group position={[o.x, y, o.z]}>
      <mesh position={[0, o.height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[o.radius, o.radius * 1.15, o.height, 12]} />
        <Toon c={scene.post} />
      </mesh>
      <mesh position={[0, o.height, 0]} castShadow>
        <sphereGeometry args={[o.radius * 1.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Toon c={scene.postCap} />
      </mesh>
      {o.id === 'post-mailbox' && (
        <group position={[0, o.height + 0.12, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.26, 0.24, 0.45]} />
            <Toon c={scene.mailbox} />
          </mesh>
          <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.13, 0.45, 12, 1, false, 0, Math.PI]} />
            <Toon c={scene.mailbox} />
          </mesh>
        </group>
      )}
      {o.id === 'post-lamp' && (
        <mesh position={[0, o.height + 0.15, 0]} castShadow>
          <sphereGeometry args={[0.2, 14, 10]} />
          <meshToonMaterial color={scene.lamp} gradientMap={toonGradient} emissive={scene.lamp} emissiveIntensity={0.35} />
        </mesh>
      )}
    </group>
  )
}

// ---------- Material spot and loads ----------
const PALLET = { w: 1.2, d: 1.0, h: 0.15 }
const BUNDLE_H = 0.18

/** A pallet with its bundles of shingles, standing on y = 0. The weight tag is left off while it's on the forks. */
export function LoadStack({ load, tag = true }: { load: Load; tag?: boolean }) {
  const over = load.weightLb > MAX_LOAD_LB
  const top = PALLET.h + load.bundles * BUNDLE_H
  if (!tag) {
    return (
      <group>
        <mesh position={[0, PALLET.h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[PALLET.w, PALLET.h, PALLET.d]} />
          <meshStandardMaterial color={scene.pallet} />
        </mesh>
        {Array.from({ length: load.bundles }, (_, i) => (
          <mesh key={i} position={[0, PALLET.h + BUNDLE_H * (i + 0.5), 0]} castShadow receiveShadow>
            <boxGeometry args={[PALLET.w - 0.1, BUNDLE_H - 0.02, PALLET.d - 0.1]} />
            <meshStandardMaterial color={over ? scene.shinglesHeavy : scene.shingles} />
          </mesh>
        ))}
      </group>
    )
  }
  return (
    <group>
      <mesh position={[0, PALLET.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[PALLET.w, PALLET.h, PALLET.d]} />
        <meshStandardMaterial color={scene.pallet} />
      </mesh>
      {Array.from({ length: load.bundles }, (_, i) => (
        <mesh key={i} position={[0, PALLET.h + BUNDLE_H * (i + 0.5), 0]} castShadow receiveShadow>
          <boxGeometry args={[PALLET.w - 0.1, BUNDLE_H - 0.02, PALLET.d - 0.1]} />
          <meshStandardMaterial color={over ? scene.shinglesHeavy : scene.shingles} />
        </mesh>
      ))}
      {/* Weight tag, so the player knows which is which */}
      <Html position={[0, top + 0.5, 0]} center distanceFactor={14} zIndexRange={[0, 0]}>
        <div
          style={{
            background: color.surfaceCanvas,
            border: `1px solid ${color.borderDivider}`,
            borderRadius: radius.md,
            padding: `${space.xs / 2}px ${space.xs}px`,
            whiteSpace: 'nowrap',
            textAlign: 'center',
            fontFamily: font.words,
            fontSize: 14,
            color: color.textPrimary,
            pointerEvents: 'none',
          }}
        >
          {load.label}
          <div style={{ fontFamily: font.numbers, fontWeight: 600 }}>{load.weightLb.toLocaleString()} LB</div>
        </div>
      </Html>
    </group>
  )
}

function MaterialSpot() {
  const m = MATERIAL_SPOT
  return (
    <group>
      <mesh position={[m.x, 0.01, m.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[m.width, m.depth]} />
        <Toon c={scene.gravel} />
      </mesh>
    </group>
  )
}

// The loads where they were left (on the ground or the roof). The one on the forks is drawn with the cab.
function Loads() {
  const spots = useSim((s) => s.loadSpots)
  return (
    <>
      {spots.map((p) => (
        <group key={p.id} position={[p.x, p.y, p.z]} rotation={[0, p.heading, 0]}>
          <LoadStack load={LOADS.find((l) => l.id === p.id)!} />
        </group>
      ))}
    </>
  )
}

export function Site() {
  return (
    <>
      <Ground />
      <House />
      <HouseDetails />
      {OBSTACLES.map((o) => (o.kind === 'bush' ? <Bush key={o.id} o={o} /> : <Post key={o.id} o={o} />))}
      <MaterialSpot />
      <Loads />
      <Nature />
    </>
  )
}

