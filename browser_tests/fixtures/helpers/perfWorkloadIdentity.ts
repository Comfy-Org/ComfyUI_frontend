import { createHash } from 'node:crypto'

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
  buildMode: 'development' | 'production' | 'test'
  browserVersion: string
  gpuClass: 'hardware' | 'software' | 'swiftshader' | 'unknown'
}

export interface PerfActivityIdentity {
  activeProgressEntries: number | null
  progressEventsEmitted: number | null
  progressEventsReceived: number | null
  progressEventsApplied: number | null
  dirtyReasons: Record<string, number> | null
  foregroundDraws: number | null
  backgroundDraws: number | null
}

export interface PerfWorkloadIdentity {
  schemaVersion: typeof PERF_IDENTITY_SCHEMA_VERSION
  topology: {
    hash: string
    nodes: number
    visibleNodes: number
    inputs: number
    outputs: number
    links: number
    maxFanOut: number
    widgets: number
  }
  activity: PerfActivityIdentity
  environment: Omit<PerfIdentitySource, 'nodes' | 'links' | 'visibleNodes'>
  missingOptionalFields: string[]
}

const ALLOWED_DIRTY_REASONS = [
  'animation',
  'background',
  'foreground',
  'layout',
  'progress',
  'unknown'
] as const

function normalizeCount(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null
}

function normalizeDirtyReasons(
  value: Record<string, number> | null | undefined
): Record<string, number> | null {
  if (!value) return null
  const entries = ALLOWED_DIRTY_REASONS.flatMap((reason) => {
    const count = normalizeCount(value[reason])
    return count === null ? [] : [[reason, count]]
  })
  return entries.length ? Object.fromEntries(entries) : null
}

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
        outputs: node.outputCount
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
  source: PerfIdentitySource,
  activity: Partial<PerfActivityIdentity> = {}
): PerfWorkloadIdentity {
  const fanOut = new Map<string, number>()
  for (const link of source.links) {
    const key = `${link.originId}:${link.originSlot}`
    fanOut.set(key, (fanOut.get(key) ?? 0) + 1)
  }
  const normalizedActivity: PerfActivityIdentity = {
    activeProgressEntries: normalizeCount(activity.activeProgressEntries),
    progressEventsEmitted: normalizeCount(activity.progressEventsEmitted),
    progressEventsReceived: normalizeCount(activity.progressEventsReceived),
    progressEventsApplied: normalizeCount(activity.progressEventsApplied),
    dirtyReasons: normalizeDirtyReasons(activity.dirtyReasons),
    foregroundDraws: normalizeCount(activity.foregroundDraws),
    backgroundDraws: normalizeCount(activity.backgroundDraws)
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
    activity: normalizedActivity,
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
    },
    missingOptionalFields: Object.entries(normalizedActivity)
      .filter(([, value]) => value === null)
      .map(([key]) => `activity.${key}`)
      .sort()
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
