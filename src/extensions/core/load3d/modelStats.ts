import * as THREE from 'three'

export interface ModelStats {
  vertices: number
  edges: number
  triangles: number
}

const EMPTY_STATS: ModelStats = {
  vertices: 0,
  edges: 0,
  triangles: 0
}

const CHUNK_SIZE = 50_000

async function yieldToEventLoop(signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
  signal?.throwIfAborted()
}

async function weldByPosition(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  signal?: AbortSignal
): Promise<{ remap: Uint32Array; uniqueCount: number }> {
  const ids = new Map<string, number>()
  const remap = new Uint32Array(position.count)
  for (let i = 0; i < position.count; i++) {
    if (i > 0 && i % CHUNK_SIZE === 0) await yieldToEventLoop(signal)
    const key = `${position.getX(i)},${position.getY(i)},${position.getZ(i)}`
    const existing = ids.get(key)
    if (existing === undefined) {
      remap[i] = ids.size
      ids.set(key, ids.size)
    } else {
      remap[i] = existing
    }
  }
  return { remap, uniqueCount: ids.size }
}

async function countTopology(
  cornerIndices: ArrayLike<number>,
  remap: Uint32Array,
  vertexCount: number,
  signal?: AbortSignal
): Promise<{ edges: number; triangles: number }> {
  const edges = new Set<number>()
  const triangles = new Set<string>()
  const cornerTriangles = Math.floor(cornerIndices.length / 3)
  for (let t = 0; t < cornerTriangles; t++) {
    if (t > 0 && t % CHUNK_SIZE === 0) await yieldToEventLoop(signal)
    const corners = [
      remap[cornerIndices[t * 3]],
      remap[cornerIndices[t * 3 + 1]],
      remap[cornerIndices[t * 3 + 2]]
    ].sort((a, b) => a - b)
    const [a, b, c] = corners
    const isDegenerate = a === b || b === c
    if (isDegenerate) continue
    const triangleKey = corners.join(',')
    if (triangles.has(triangleKey)) continue
    triangles.add(triangleKey)
    edges.add(a * vertexCount + b)
    edges.add(b * vertexCount + c)
    edges.add(a * vertexCount + c)
  }
  return { edges: edges.size, triangles: triangles.size }
}

function sequentialCorners(count: number): Uint32Array {
  return Uint32Array.from({ length: count }, (_, i) => i)
}

async function meshStats(
  mesh: THREE.Mesh,
  signal?: AbortSignal
): Promise<ModelStats> {
  const position = mesh.geometry.getAttribute('position')
  if (!position) return EMPTY_STATS

  const { remap, uniqueCount } = await weldByPosition(position, signal)
  const corners = mesh.geometry.index?.array ?? sequentialCorners(remap.length)
  const { edges, triangles } = await countTopology(
    corners,
    remap,
    uniqueCount,
    signal
  )
  const instances = mesh instanceof THREE.InstancedMesh ? mesh.count : 1

  return {
    vertices: uniqueCount * instances,
    edges: edges * instances,
    triangles: triangles * instances
  }
}

function pointsStats(points: THREE.Points): ModelStats {
  const position = points.geometry.getAttribute('position')
  return { ...EMPTY_STATS, vertices: position?.count ?? 0 }
}

function addStats(a: ModelStats, b: ModelStats): ModelStats {
  return {
    vertices: a.vertices + b.vertices,
    edges: a.edges + b.edges,
    triangles: a.triangles + b.triangles
  }
}

export async function computeModelStats(
  root: THREE.Object3D,
  signal?: AbortSignal
): Promise<ModelStats> {
  signal?.throwIfAborted()
  const meshes: THREE.Mesh[] = []
  let total = EMPTY_STATS
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshes.push(child)
    } else if (child instanceof THREE.Points) {
      total = addStats(total, pointsStats(child))
    }
  })
  for (const mesh of meshes) {
    const stats = await meshStats(mesh, signal)
    signal?.throwIfAborted()
    total = addStats(total, stats)
  }
  return total
}

export function hasGeometry(stats: ModelStats): boolean {
  return stats.vertices > 0
}
