import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MANIFEST_PATH = fileURLToPath(
  new URL('../data/customNodeManifest.json', import.meta.url)
)

type CustomNodeTier = 'load' | 'run' | 'connectivity' | 'io'

export interface CustomNodeManifestEntry {
  pack: string
  repo: string
  pin: string
  tiers: CustomNodeTier[]
  // Frontend-format workflow (path relative to browser_tests/) loaded and queued
  // by the run/io tiers; empty or absent file = tier skips. Run the backend with
  // --cache-none, or repeat runs classify PARTIAL when cached nodes skip executing.
  workflow: string
  // Runtime class_type / object_info keys, NOT Python class names (e.g. rgthree
  // registers "Power Primitive (rgthree)", not RgthreePowerPrimitive).
  expectedNodes: string[]
  requiresGpu: boolean
  requiresModels: string[]
  timeoutMs: number
}

function assertEntry(entry: CustomNodeManifestEntry, index: number): void {
  const missing: string[] = []
  if (typeof entry.pack !== 'string' || entry.pack.length === 0)
    missing.push('pack')
  // workflow may be an empty string until the pack gains a run-tier fixture.
  if (typeof entry.workflow !== 'string') missing.push('workflow')
  if (!Array.isArray(entry.expectedNodes) || entry.expectedNodes.length === 0)
    missing.push('expectedNodes')
  if (!Array.isArray(entry.tiers) || entry.tiers.length === 0)
    missing.push('tiers')
  if (!Array.isArray(entry.requiresModels)) missing.push('requiresModels')
  if (typeof entry.requiresGpu !== 'boolean') missing.push('requiresGpu')
  if (!Number.isFinite(entry.timeoutMs) || entry.timeoutMs <= 0)
    missing.push('timeoutMs')
  if (missing.length > 0)
    throw new Error(
      `custom-node manifest entry ${index} (${entry.pack ?? '?'}) missing: ${missing.join(', ')}`
    )
}

export function loadManifest(): CustomNodeManifestEntry[] {
  const entries = JSON.parse(
    readFileSync(MANIFEST_PATH, 'utf-8')
  ) as CustomNodeManifestEntry[]
  entries.forEach(assertEntry)
  return entries
}
