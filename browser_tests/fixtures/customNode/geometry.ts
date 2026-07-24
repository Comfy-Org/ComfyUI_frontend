import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { customNodesEnv } from '@e2e/fixtures/customNode/manifest'

const GEOMETRY_DIR = fileURLToPath(new URL('./geometry/', import.meta.url))

// Cloud baselines are a separate set under geometry/cloud/: Cloud's pack
// versions move with Cloud deploys, not our pins, so the two environments
// never share a baseline file. Resolved per call so the env is read at use
// time, exactly like the manifest loader.
function geometryDir(): string {
  return customNodesEnv() === 'cloud' ? `${GEOMETRY_DIR}cloud/` : GEOMETRY_DIR
}

// Repo-relative counterpart for human-facing messages (the record-mode
// commit instruction names the file to commit).
export function packGeometryRelativePath(pack: string): string {
  const cloudSegment = customNodesEnv() === 'cloud' ? 'cloud/' : ''
  return `browser_tests/fixtures/customNode/geometry/${cloudSegment}${pack}.json`
}

// Every value is relative to the node's own origin, so baselines are
// invariant to where the chunk grid placed the node. Vue values are divided
// by the canvas scale at capture (the chunk-fit zoom), making them
// graph-space numbers too - otherwise a pack-count change would rescale
// whole chunks and every node in them would show phantom deltas. Values are
// stored raw and compared with exact equality, no rounding: in a fully
// pinned environment the render is deterministic, and rounding is a
// tolerance in disguise. If jitter is ever observed, that red is the
// evidence to justify one. The scale division leaves ~1e-5 float
// residuals in Vue values, so a chunk-composition change (the pack's
// node count moved) perturbs them and forces a whole-pack re-record -
// which the pin-bump flow performs anyway. Same-composition determinism
// is proven: two independent CI runs came back byte-exact outside the
// ledgered nodes below.
export interface LitegraphNodeGeometry {
  w: number
  h: number
  // Model-order widget vertical offsets (widget.last_y after a drawn
  // frame; null when the renderer never assigned one).
  widgets: Array<{ name: string; y: number | null }>
  // Slot connection positions relative to node origin, model order.
  inputs: Array<[number, number]>
  outputs: Array<[number, number]>
}

export interface VueNodeGeometry {
  w: number
  h: number
  // DOM widget rows in document order: vertical offset from the node root
  // plus row height - a collapsed row is exactly the shrinking-bug class.
  widgets: Array<{ dy: number; h: number }>
  // Slot connection dots relative to the node root, document order.
  slots: Array<[number, number]>
}

export interface NodeGeometry {
  litegraph: LitegraphNodeGeometry
  // Absent for nodes ledgered vue-incompatible: their Vue mount is not
  // asserted, so there is no Vue render to measure.
  vue?: VueNodeGeometry
}

export interface PackGeometryFile {
  // Provenance: the pinned world that produced these numbers, so a
  // baseline diff is traceable to the pin/core change that moved it.
  recordedAt: { core: string; pin: string }
  schema: 1
  nodes: Record<string, NodeGeometry>
}

// Nodes whose initial layout is not deterministic run-to-run, keyed by the
// MECHANISM that makes them racy (same discipline as the console ledger's
// mechanism patterns): each exclusion carries a written reason, is
// registration-guarded in the spec (an entry whose node leaves the corpus
// reds), announced in the run output like every other escape hatch, and
// excluded nodes are omitted from baselines entirely - never compared
// against a committed expectation they cannot meet.
export const GEOMETRY_UNSTABLE_NODES: Record<string, Record<string, string>> = {
  'ComfyUI-KJNodes': {
    // Both editor_base subclasses: widget layout depends on whether the
    // pack's editor DOM finished initializing when the frame drew - the
    // same init race the console ledger documents for editor creation.
    // Observed live: SplineEditor widgets[13].y measured 915 in the CI
    // record run and 920 in the CI compare run at identical code.
    SplineEditor: 'editor_base init race shifts widget y between runs',
    PointsEditor: 'same editor_base init race as SplineEditor'
  }
}

function geometryPath(pack: string): string {
  return `${geometryDir()}${pack}.json`
}

// null = no baseline recorded yet; the caller decides whether that reds
// (compare mode must - a silently uncovered pack is the failure mode this
// suite bans everywhere) or is expected (record mode).
export function loadPackGeometry(pack: string): PackGeometryFile | null {
  const path = geometryPath(pack)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as PackGeometryFile
}

export function savePackGeometry(pack: string, file: PackGeometryFile): void {
  mkdirSync(geometryDir(), { recursive: true })
  writeFileSync(geometryPath(pack), JSON.stringify(file, null, 1) + '\n')
}

// Depth-first first-difference finder. Returns every node-level delta but
// only the first differing field per node, so a real layout shift reads as
// one line per affected node instead of hundreds of coordinates.
function firstDelta(
  expected: unknown,
  actual: unknown,
  path: string
): string | null {
  if (typeof expected !== typeof actual)
    return `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  if (
    expected === null ||
    actual === null ||
    typeof expected !== 'object' ||
    typeof actual !== 'object'
  )
    return expected === actual
      ? null
      : `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  if (Array.isArray(expected) || Array.isArray(actual)) {
    const a = expected as unknown[]
    const b = actual as unknown[]
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return `${path}: expected length ${Array.isArray(a) ? a.length : '?'}, got ${Array.isArray(b) ? b.length : '?'}`
    for (const [index, item] of a.entries()) {
      const delta = firstDelta(item, b[index], `${path}[${index}]`)
      if (delta) return delta
    }
    return null
  }
  const aRecord = expected as Record<string, unknown>
  const bRecord = actual as Record<string, unknown>
  for (const key of new Set([
    ...Object.keys(aRecord),
    ...Object.keys(bRecord)
  ])) {
    const delta = firstDelta(aRecord[key], bRecord[key], `${path}.${key}`)
    if (delta) return delta
  }
  return null
}

// Two-way, like every list in this suite: a measured node without a
// baseline reds (new pack or node - record), a baseline node no longer
// measured reds (stale baseline - re-record), and any value delta reds
// with the first differing field named.
export function diffGeometry(
  baseline: Record<string, NodeGeometry>,
  measured: Record<string, NodeGeometry>
): string[] {
  const failures: string[] = []
  for (const key of Object.keys(measured))
    if (!(key in baseline))
      failures.push(
        `${key}: no geometry baseline - re-record via the record workflow (ADDING_CUSTOM_NODES.md Step 5b) with the change that added it`
      )
  for (const [key, expected] of Object.entries(baseline)) {
    const actual = measured[key]
    if (!actual) {
      failures.push(
        `${key}: baseline entry but the node was not measured - stale baseline, re-record`
      )
      continue
    }
    const delta = firstDelta(expected, actual, key)
    if (delta) failures.push(delta)
  }
  return failures
}
