import * as THREE from 'three'

import { createTupleSet } from './tupleSet'

function throwIfSignalAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return
  throw signal.reason === undefined
    ? new DOMException('This operation was aborted', 'AbortError')
    : signal.reason
}

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
  throwIfSignalAborted(signal)
}

async function weldByPosition(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  signal?: AbortSignal
): Promise<{ remap: Uint32Array; uniqueCount: number }> {
  const positions = createTupleSet(3)
  const remap = new Uint32Array(position.count)
  const coordinates = new Float32Array(3)
  const coordinateBits = new Uint32Array(coordinates.buffer)
  for (let i = 0; i < position.count; i++) {
    if (i > 0 && i % CHUNK_SIZE === 0) await yieldToEventLoop(signal)
    coordinates[0] = Math.fround(position.getX(i)) + 0
    coordinates[1] = Math.fround(position.getY(i)) + 0
    coordinates[2] = Math.fround(position.getZ(i)) + 0
    remap[i] = positions.add(
      coordinateBits[0],
      coordinateBits[1],
      coordinateBits[2]
    )
  }
  return { remap, uniqueCount: positions.size }
}

async function countTopology(
  cornerIndices: ArrayLike<number>,
  remap: Uint32Array,
  signal?: AbortSignal
): Promise<{ edges: number; triangles: number }> {
  const edges = createTupleSet(2)
  const triangles = createTupleSet(3)
  const cornerTriangles = Math.floor(cornerIndices.length / 3)
  for (let t = 0; t < cornerTriangles; t++) {
    if (t > 0 && t % CHUNK_SIZE === 0) await yieldToEventLoop(signal)
    const [a, b, c] = [
      remap[cornerIndices[t * 3]],
      remap[cornerIndices[t * 3 + 1]],
      remap[cornerIndices[t * 3 + 2]]
    ].sort((a, b) => a - b)
    const isDegenerate = a === b || b === c
    if (isDegenerate) continue
    const knownTriangles = triangles.size
    triangles.add(a, b, c)
    if (triangles.size === knownTriangles) continue
    edges.add(a, b)
    edges.add(b, c)
    edges.add(a, c)
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
  if (!mesh.geometry.hasAttribute('position')) return EMPTY_STATS
  const position = mesh.geometry.getAttribute('position')

  const { remap, uniqueCount } = await weldByPosition(position, signal)
  const corners = mesh.geometry.index?.array ?? sequentialCorners(remap.length)
  const { edges, triangles } = await countTopology(corners, remap, signal)
  const instances = mesh instanceof THREE.InstancedMesh ? mesh.count : 1

  return {
    vertices: uniqueCount * instances,
    edges: edges * instances,
    triangles: triangles * instances
  }
}

function pointsStats(points: THREE.Points): ModelStats {
  const { geometry } = points
  const vertices = geometry.hasAttribute('position')
    ? geometry.getAttribute('position').count
    : 0
  return { ...EMPTY_STATS, vertices }
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
  throwIfSignalAborted(signal)
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
    throwIfSignalAborted(signal)
    total = addStats(total, stats)
  }
  return total
}

export function hasGeometry(stats: ModelStats): boolean {
  return stats.vertices > 0
}
