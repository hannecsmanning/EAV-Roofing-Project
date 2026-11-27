// House details (Hanne): windows on every side, corner trim, a fascia board under the roof edge, a foundation strip,
// gutters and downspouts, a small porch at the front door, a garage door, and a chimney and vents on the roof.
// Colors match the rest of the toned-down autumn palette. The chimney and vents are obstacles (siteLayout ROOF_ITEMS).
import { useMemo } from 'react'
import { scene } from '../tokens/tokens'
import { HOUSE, WALL_OUTLINE, ROOF_OUTLINE, ROOF_ITEMS, roofItemTop, type RoofItem } from './siteLayout'
import { isInside } from './roofShape'
import { toonGradient } from './look'

const Toon = ({ c }: { c: string }) => <meshToonMaterial color={c} gradientMap={toonGradient} />

type Edge = { ax: number; az: number; bx: number; bz: number; len: number; nx: number; nz: number; yaw: number }

/** The sides of an outline, each with its outward direction. */
function edgesOf(poly: [number, number][], inside: [number, number][]): Edge[] {
  return poly.map(([ax, az], i) => {
    const [bx, bz] = poly[(i + 1) % poly.length]
    const len = Math.hypot(bx - ax, bz - az)
    let nx = (bz - az) / len
    let nz = -(bx - ax) / len
    // Point the normal away from the house.
    if (isInside(inside, (ax + bx) / 2 + nx * 0.2, (az + bz) / 2 + nz * 0.2)) {
      nx = -nx
      nz = -nz
    }
    return { ax, az, bx, bz, len, nx, nz, yaw: Math.atan2(nx, nz) }
  })
}

// Where the front door and the garage door are (front walls), so windows leave room for them.
export const DOOR = { x: 0, z: -3.25, half: 1.4 }
export const GARAGE = { x: 15, z: -5.75, half: 2.2 }

/** A window with a light frame, a cross bar and a sill. Faces +z. */
function Window() {
  return (
    <group>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[1.08, 1.18, 0.05]} />
        <Toon c={scene.trim} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[0.9, 1, 0.03]} />
        <Toon c={scene.window} />
      </mesh>
      <mesh position={[0, 0, 0.06]}>
        <boxGeometry args={[0.05, 1, 0.02]} />
        <Toon c={scene.trim} />
      </mesh>
      <mesh position={[0, -0.6, 0.08]}>
        <boxGeometry args={[1.2, 0.07, 0.16]} />
        <Toon c={scene.trim} />
      </mesh>
    </group>
  )
}

/** Windows along every wall: about one every 3 m, upstairs and down, clear of the corners, the door and the garage. */
function Windows({ edges }: { edges: Edge[] }) {
  const spots = useMemo(() => {
    const out: { x: number; z: number; y: number; yaw: number }[] = []
    for (const e of edges) {
      const n = Math.floor(e.len / 3)
      if (e.len < 2.4 || n < 1) continue
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n
        const x = e.ax + (e.bx - e.ax) * t + e.nx * 0.02
        const z = e.az + (e.bz - e.az) * t + e.nz * 0.02
        for (const y of [1.7, HOUSE.wallHeight - 1.6]) {
          const atDoor = Math.abs(z - DOOR.z) < 0.1 && Math.abs(x - DOOR.x) < DOOR.half
          const atGarage = y < 3 && Math.abs(z - GARAGE.z) < 0.1 && Math.abs(x - GARAGE.x) < GARAGE.half + 0.7
          if (atDoor && y < 3) continue
          if (atGarage) continue
          out.push({ x, z, y, yaw: e.yaw })
        }
      }
    }
    return out
  }, [edges])
  return (
    <>
      {spots.map((w, i) => (
        <group key={i} position={[w.x, w.y, w.z]} rotation={[0, w.yaw, 0]}>
          <Window />
        </group>
      ))}
    </>
  )
}

/** A box laid along an edge: `along` covers the edge, `up` tall, `out` deep, centered `off` meters outside it. */
function AlongEdge({ e, y, up, out, off, c }: { e: Edge; y: number; up: number; out: number; off: number; c: string }) {
  return (
    // Thin trim doesn't cast shadows: at this shadow sharpness they only make jagged slivers on the walls.
    <mesh position={[(e.ax + e.bx) / 2 + e.nx * off, y, (e.az + e.bz) / 2 + e.nz * off]} rotation={[0, e.yaw, 0]} receiveShadow>
      <boxGeometry args={[e.len + out * 2, up, out]} />
      <Toon c={c} />
    </mesh>
  )
}

/** Corner trim, the foundation strip along the bottom, the fascia under the roof edge and the gutters on it. */
function Trim({ walls, roof }: { walls: Edge[]; roof: Edge[] }) {
  const H = HOUSE.wallHeight
  return (
    <>
      {walls.map((e, i) => (
        <group key={`w${i}`}>
          <AlongEdge e={e} y={0.22} up={0.44} out={0.07} off={0.035} c={scene.base} />
        </group>
      ))}
      {WALL_OUTLINE.map(([x, z], i) => (
        <mesh key={`c${i}`} position={[x, H / 2, z]}>
          <boxGeometry args={[0.2, H, 0.2]} />
          <Toon c={scene.trim} />
        </mesh>
      ))}
      {roof.map((e, i) => (
        <group key={`r${i}`}>
          {/* Fascia board just under the roof edge */}
          <AlongEdge e={e} y={H - 0.12} up={0.24} out={0.06} off={0.02} c={scene.trim} />
          {/* Gutter running along it */}
          <AlongEdge e={e} y={H - 0.1} up={0.13} out={0.14} off={0.12} c={scene.gutter} />
        </group>
      ))}
    </>
  )
}

/** Downspouts: down some of the outside corners, from the gutter to the ground. */
function Downspouts({ walls }: { walls: Edge[] }) {
  const H = HOUSE.wallHeight
  const corners = useMemo(() => {
    const out: { x: number; z: number; ox: number; oz: number }[] = []
    walls.forEach((e, i) => {
      if (i % 3 !== 0) return
      const prev = walls[(i + walls.length - 1) % walls.length]
      // Only outside corners: the corner point pushed out along both walls' outward directions stays outside.
      const ox = e.nx + prev.nx
      const oz = e.nz + prev.nz
      if (isInside(WALL_OUTLINE, e.ax + ox * 0.3, e.az + oz * 0.3)) return
      out.push({ x: e.ax + ox * 0.18, z: e.az + oz * 0.18, ox, oz })
    })
    return out
  }, [walls])
  return (
    <>
      {corners.map((c, i) => (
        <group key={i}>
          <mesh position={[c.x, (H - 0.3) / 2, c.z]} castShadow>
            <boxGeometry args={[0.11, H - 0.3, 0.11]} />
            <Toon c={scene.gutter} />
          </mesh>
          {/* Elbow out to the gutter at the roof edge */}
          <mesh position={[c.x + c.ox * 0.22, H - 0.25, c.z + c.oz * 0.22]} castShadow>
            <boxGeometry args={[0.11 + Math.abs(c.ox) * 0.4, 0.11, 0.11 + Math.abs(c.oz) * 0.4]} />
            <Toon c={scene.gutter} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** The front porch: a small roof over the door on two posts. It stays under the main roof's overhang. */
function Porch() {
  const z = DOOR.z
  return (
    <group position={[DOOR.x, 0, z]}>
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, 1.3, 0.55]} castShadow>
          <boxGeometry args={[0.14, 2.6, 0.14]} />
          <Toon c={scene.trim} />
        </mesh>
      ))}
      <mesh position={[0, 2.66, 0.33]} rotation={[0.18, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.3, 0.1, 0.85]} />
        <Toon c={scene.roof} />
      </mesh>
    </group>
  )
}

/** The garage door: a wide panel door with horizontal grooves and a trim frame. */
function Garage() {
  return (
    <group position={[GARAGE.x, 0, GARAGE.z + 0.02]}>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[GARAGE.half * 2 + 0.3, 2.65, 0.05]} />
        <Toon c={scene.trim} />
      </mesh>
      <mesh position={[0, 1.15, 0.04]}>
        <boxGeometry args={[GARAGE.half * 2, 2.3, 0.04]} />
        <Toon c={scene.garage} />
      </mesh>
      {[0.55, 1.1, 1.65].map((y) => (
        <mesh key={y} position={[0, y, 0.07]}>
          <boxGeometry args={[GARAGE.half * 2 - 0.1, 0.04, 0.02]} />
          <Toon c={scene.garageLine} />
        </mesh>
      ))}
    </group>
  )
}

/** The chimney (brick red with a dark cap) and the round vents. Sunk a little into the roof so the slope doesn't show a gap. */
function RoofItemMesh({ item }: { item: RoofItem }) {
  const top = roofItemTop(item)
  const bottom = top - item.height - 0.5
  const h = top - bottom
  if (item.kind === 'chimney') {
    return (
      <group position={[item.x, 0, item.z]}>
        <mesh position={[0, bottom + h / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[item.half * 2, h, item.half * 2]} />
          <Toon c={scene.chimney} />
        </mesh>
        <mesh position={[0, top + 0.06, 0]} castShadow>
          <boxGeometry args={[item.half * 2 + 0.2, 0.12, item.half * 2 + 0.2]} />
          <Toon c={scene.chimneyCap} />
        </mesh>
      </group>
    )
  }
  return (
    <group position={[item.x, 0, item.z]}>
      <mesh position={[0, bottom + h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[item.half * 0.8, item.half * 0.8, h, 16]} />
        <Toon c={scene.vent} />
      </mesh>
      <mesh position={[0, top + 0.05, 0]} castShadow>
        <cylinderGeometry args={[item.half * 1.1, item.half * 1.1, 0.08, 16]} />
        <Toon c={scene.ventCap} />
      </mesh>
    </group>
  )
}

export function HouseDetails() {
  const walls = useMemo(() => edgesOf(WALL_OUTLINE, WALL_OUTLINE), [])
  const roof = useMemo(() => edgesOf(ROOF_OUTLINE, ROOF_OUTLINE), [])
  return (
    <>
      <Windows edges={walls} />
      <Trim walls={walls} roof={roof} />
      <Downspouts walls={walls} />
      <Porch />
      <Garage />
      {ROOF_ITEMS.map((i) => (
        <RoofItemMesh key={i.id} item={i} />
      ))}
    </>
  )
}

