import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MANIFEST_PATH = 'browser_tests/fixtures/data/customNodeManifest.json'

export type CustomNodeTier = 'load' | 'run' | 'io'

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
  const missing: string[] = (
    ['pack', 'workflow', 'expectedNodes', 'tiers', 'requiresModels'] as const
  ).filter((key) => entry[key] == null)
  if (typeof entry.timeoutMs !== 'number') missing.push('timeoutMs')
  if (missing.length > 0)
    throw new Error(
      `custom-node manifest entry ${index} (${entry.pack ?? '?'}) missing: ${missing.join(', ')}`
    )
}

export function loadManifest(): CustomNodeManifestEntry[] {
  const entries = JSON.parse(
    readFileSync(resolve(MANIFEST_PATH), 'utf-8')
  ) as CustomNodeManifestEntry[]
  entries.forEach(assertEntry)
  return entries
}
