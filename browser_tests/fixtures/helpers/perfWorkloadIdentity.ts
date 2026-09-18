import { createHash } from 'node:crypto'

import { z } from 'zod'

const PERF_IDENTITY_SCHEMA_VERSION = 1 as const

export interface PerfTopologyNode {
  id: string
  type: string
  inputCount: number
  outputCount: number
  widgetCount: number
}

export interface PerfTopologyLink {
  originId: string
  originSlot: number
  targetId: string
  targetSlot: number
}

export interface PerfIdentitySource {
  nodes: PerfTopologyNode[]
  links: PerfTopologyLink[]
  visibleNodes: number
  renderer: 'legacy' | 'vue'
  canvasInfoEnabled: boolean | null
  viewportWidth: number
  viewportHeight: number
  devicePixelRatio: number
  frontendVersion: string
  frontendCommit: string
  buildMode: string
  browserVersion: string
  gpuClass: 'hardware' | 'software' | 'swiftshader' | 'unknown'
}

export const perfWorkloadIdentitySchema = z.object({
  schemaVersion: z.literal(PERF_IDENTITY_SCHEMA_VERSION),
  topology: z.object({
    hash: z.string(),
    nodes: z.number(),
    visibleNodes: z.number(),
    inputs: z.number(),
    outputs: z.number(),
    links: z.number(),
    maxFanOut: z.number(),
    widgets: z.number()
  }),
  environment: z.object({
    renderer: z.enum(['legacy', 'vue']),
    canvasInfoEnabled: z.boolean().nullable(),
    viewportWidth: z.number(),
    viewportHeight: z.number(),
    devicePixelRatio: z.number(),
    frontendVersion: z.string(),
    frontendCommit: z.string(),
    buildMode: z.string().min(1),
    browserVersion: z.string(),
    gpuClass: z.enum(['hardware', 'software', 'swiftshader', 'unknown'])
  })
})

export type PerfWorkloadIdentity = z.infer<typeof perfWorkloadIdentitySchema>

export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`
}

export function hashTopology(
  nodes: PerfTopologyNode[],
  links: PerfTopologyLink[]
): string {
  const sortedIds = [...new Set(nodes.map((node) => node.id))].sort()
  const aliases = new Map(sortedIds.map((id, index) => [id, index]))
  const topology = {
    nodes: [...nodes]
      .map((node) => ({
        id: aliases.get(node.id),
        type: node.type,
        inputs: node.inputCount,
        outputs: node.outputCount,
        widgets: node.widgetCount
      }))
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0)),
    links: [...links]
      .map((link) => ({
        origin: aliases.get(link.originId),
        originSlot: link.originSlot,
        target: aliases.get(link.targetId),
        targetSlot: link.targetSlot
      }))
      .sort((a, b) => stableSerialize(a).localeCompare(stableSerialize(b)))
  }
  return `sha256:${createHash('sha256')
    .update(stableSerialize(topology))
    .digest('hex')}`
}

export function buildPerfWorkloadIdentity(
  source: PerfIdentitySource
): PerfWorkloadIdentity {
  const fanOut = new Map<string, number>()
  for (const link of source.links) {
    const key = `${link.originId}:${link.originSlot}`
    fanOut.set(key, (fanOut.get(key) ?? 0) + 1)
  }
  return {
    schemaVersion: PERF_IDENTITY_SCHEMA_VERSION,
    topology: {
      hash: hashTopology(source.nodes, source.links),
      nodes: source.nodes.length,
      visibleNodes: source.visibleNodes,
      inputs: source.nodes.reduce((sum, node) => sum + node.inputCount, 0),
      outputs: source.nodes.reduce((sum, node) => sum + node.outputCount, 0),
      links: source.links.length,
      maxFanOut: Math.max(0, ...fanOut.values()),
      widgets: source.nodes.reduce((sum, node) => sum + node.widgetCount, 0)
    },
    environment: {
      renderer: source.renderer,
      canvasInfoEnabled: source.canvasInfoEnabled,
      viewportWidth: source.viewportWidth,
      viewportHeight: source.viewportHeight,
      devicePixelRatio: source.devicePixelRatio,
      frontendVersion: source.frontendVersion,
      frontendCommit: source.frontendCommit,
      buildMode: source.buildMode,
      browserVersion: source.browserVersion,
      gpuClass: source.gpuClass
    }
  }
}

function comparisonIdentity(identity: PerfWorkloadIdentity): string {
  const { topology, environment } = identity
  return stableSerialize({
    schemaVersion: identity.schemaVersion,
    topology,
    environment: {
      renderer: environment.renderer,
      canvasInfoEnabled: environment.canvasInfoEnabled,
      viewportWidth: environment.viewportWidth,
      viewportHeight: environment.viewportHeight,
      devicePixelRatio: environment.devicePixelRatio,
      buildMode: environment.buildMode,
      browserVersion: environment.browserVersion,
      gpuClass: environment.gpuClass
    }
  })
}

export function filterComparableWorkloads<
  T extends { workloadIdentity?: PerfWorkloadIdentity }
>(reference: T, candidates: T[]): T[] {
  if (!reference.workloadIdentity) return []
  const referenceIdentity = comparisonIdentity(reference.workloadIdentity)
  return candidates.filter(
    ({ workloadIdentity }) =>
      workloadIdentity &&
      comparisonIdentity(workloadIdentity) === referenceIdentity
  )
}
