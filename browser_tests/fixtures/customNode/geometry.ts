import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { customNodesEnv } from '@e2e/fixtures/customNode/manifest'

const GEOMETRY_DIR = fileURLToPath(new URL('./geometry/', import.meta.url))

function geometryDir(): string {
  return customNodesEnv() === 'cloud' ? `${GEOMETRY_DIR}cloud/` : GEOMETRY_DIR
}

export function packGeometryRelativePath(pack: string): string {
  const cloudSegment = customNodesEnv() === 'cloud' ? 'cloud/' : ''
  return `browser_tests/fixtures/customNode/geometry/${cloudSegment}${pack}.json`
}

// Every value is relative to the node's own origin, so baselines are
// invariant to where the chunk grid placed the node. Vue values are divided
// by the canvas scale at capture (the chunk-fit zoom), making them
// graph-space numbers too - otherwise a pack-count change would rescale
// whole chunks and every node in them would show phantom deltas.
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

// Nodes whose initial layout is not reproducible run-to-run - a race, or a
// layout that follows environment content - keyed by the MECHANISM that
// makes them unreproducible (same discipline as the console ledger's
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
    PointsEditor: 'same editor_base init race as SplineEditor',
    // Observed live: litegraph height read 566 in the record run and one
    // compare run, 354 in another - the node sizes to the backend input dir.
    LoadAndResizeImage: 'litegraph height follows input-dir preview contents'
  }
}

// Exact fields whose values follow asynchronous environment content while
// every other field on the same node remains deterministic and strict.
export const GEOMETRY_UNSTABLE_PATHS: Record<
  string,
  Record<string, Record<string, string>>
> = {
  'ComfyUI-VideoHelperSuite': {
    // Observed live in run 31513986272 (rerun of the identical SHA passed):
    // the preview widget one index BELOW the ledgered one collapsed to 0
    // (LoadImages widgets[4], LoadVideo widgets[8], FFmpeg widgets[7]) and
    // VHS_LoadAudioUpload.vue.h read 24px short - the async default-media
    // mechanism at the adjacent widget slot, plus the audio variant.
    VHS_LoadAudioUpload: {
      'vue.h':
        'upload preview row follows the asynchronous default-media mechanism (observed 250 -> 226 in run 31513986272)'
    },
    VHS_LoadImages: {
      'vue.h':
        'preview height follows asynchronously loaded default-media aspect ratio',
      'vue.widgets[4].h':
        'preview widget collapses to 0 when the async default-media resolves empty (observed in run 31513986272)',
      'vue.widgets[5].h':
        'preview widget height follows the same asynchronous default-media aspect-ratio mechanism'
    },
    VHS_LoadVideo: {
      'vue.h':
        'preview height follows asynchronously loaded default-media aspect ratio',
      'vue.widgets[8].h':
        'preview widget collapses to 0 when the async default-media resolves empty (observed in run 31513986272)',
      'vue.widgets[9].h':
        'preview widget height follows the same asynchronous default-media aspect-ratio mechanism'
    },
    VHS_LoadVideoFFmpeg: {
      'vue.h':
        'preview height follows the same asynchronous default-media aspect-ratio mechanism',
      'vue.widgets[7].h':
        'preview widget collapses to 0 when the async default-media resolves empty (observed in run 31513986272)',
      'vue.widgets[8].h':
        'preview widget height follows the same asynchronous default-media aspect-ratio mechanism'
    },
    VHS_LoadVideoFFmpegPath: {
      'vue.h':
        'preview height follows asynchronously loaded default-media aspect ratio',
      'vue.widgets[7].h':
        'preview widget height follows the same asynchronous default-media aspect-ratio mechanism'
    },
    VHS_LoadVideoPath: {
      'vue.h':
        'preview height follows asynchronously loaded default-media aspect ratio',
      'vue.widgets[8].h':
        'preview widget height follows the same asynchronous default-media aspect-ratio mechanism'
    }
  },
  // Observed live: run 31537261792 measured every one of these nine nodes
  // 8-48px shorter in vue.h than run 31518805275 recorded at identical suite
  // code, while EVERY widget height on the same nodes matched the baseline
  // exactly - the flip sits in slot/section layout, not in any widget. Only
  // vue.h is relaxed; widget geometry stays strict.
  'was-node-suite-comfyui': {
    'BLIP Analyze Image': {
      'vue.h':
        'vue node height flips between identical runs with all widget heights stable (observed 320 -> 282)'
    },
    'BLIP Model Loader': {
      'vue.h':
        'vue node height flips between identical runs with all widget heights stable (observed 164 -> 148)'
    },
    CLIPSEG2: {
      'vue.h':
        'vue node height flips between identical runs with all widget heights stable (observed 148 -> 140)'
    },
    'CLIPSeg Batch Masking': {
      'vue.h':
        'vue node height flips between identical runs with all widget heights stable (observed 380 -> 332)'
    },
    'CLIPSeg Masking': {
      'vue.h':
        'vue node height flips between identical runs with all widget heights stable (observed 120 -> 112)'
    },
    'CLIPSeg Model Loader': {
      'vue.h':
        'vue node height flips between identical runs with all widget heights stable (observed 100 -> 92)'
    },
    'CLIPTextEncode (NSP)': {
      'vue.h':
        'vue node height flips between identical runs with all widget heights stable (observed 264 -> 254)'
    },
    'Cache Node': {
      'vue.h':
        'vue node height flips between identical runs with all widget heights stable (observed 248 -> 216)'
    },
    'Create Grid Image': {
      'vue.h':
        'vue node height flips between identical runs with all widget heights stable (observed 332 -> 316)'
    }
  }
}

function geometryPath(pack: string): string {
  return `${geometryDir()}${pack}.json`
}

export function loadPackGeometry(pack: string): PackGeometryFile | null {
  const path = geometryPath(pack)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8')) as PackGeometryFile
}

export function savePackGeometry(pack: string, file: PackGeometryFile): void {
  mkdirSync(geometryDir(), { recursive: true })
  writeFileSync(geometryPath(pack), JSON.stringify(file, null, 1) + '\n')
}

const GEOMETRY_EPSILON_PX = 0.01

// Depth-first first-difference finder. Returns every node-level delta but
// only the first differing field per node, so a real layout shift reads as
// one line per affected node instead of hundreds of coordinates.
function firstDelta(
  expected: unknown,
  actual: unknown,
  path: string,
  ignoredPaths: ReadonlySet<string>
): string | null {
  if (ignoredPaths.has(path)) return null
  if (typeof expected !== typeof actual)
    return `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  if (
    expected === null ||
    actual === null ||
    typeof expected !== 'object' ||
    typeof actual !== 'object'
  ) {
    if (typeof expected === 'number' && typeof actual === 'number')
      return Math.abs(expected - actual) <= GEOMETRY_EPSILON_PX
        ? null
        : `${path}: expected ${expected}, got ${actual}`
    return expected === actual
      ? null
      : `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    const a = expected as unknown[]
    const b = actual as unknown[]
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return `${path}: expected length ${Array.isArray(a) ? a.length : '?'}, got ${Array.isArray(b) ? b.length : '?'}`
    for (const [index, item] of a.entries()) {
      const delta = firstDelta(
        item,
        b[index],
        `${path}[${index}]`,
        ignoredPaths
      )
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
    const delta = firstDelta(
      aRecord[key],
      bRecord[key],
      `${path}.${key}`,
      ignoredPaths
    )
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
  measured: Record<string, NodeGeometry>,
  ignoredPaths: Record<string, Record<string, string>> = {}
): string[] {
  const failures: string[] = []
  for (const key of Object.keys(measured))
    if (!(key in baseline))
      failures.push(
        `${key}: no geometry baseline - re-record via the record workflow (docs/custom-node-regression-suite.md Step 5b) with the change that added it`
      )
  for (const [key, expected] of Object.entries(baseline)) {
    const actual = measured[key]
    if (!actual) {
      failures.push(
        `${key}: baseline entry but the node was not measured - stale baseline, re-record`
      )
      continue
    }
    const delta = firstDelta(
      expected,
      actual,
      key,
      new Set(
        Object.keys(ignoredPaths[key] ?? {}).map((path) => `${key}.${path}`)
      )
    )
    if (delta) failures.push(delta)
  }
  return failures
}
