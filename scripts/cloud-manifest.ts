import type {
  CloudManifest,
  CloudManifestEntry
} from '../browser_tests/fixtures/customNode/manifest'
import { assertCloudEntry } from '../browser_tests/fixtures/customNode/manifest'
import type { RawNodeDef } from '../browser_tests/fixtures/customNode/typePairing'
import { packOf } from '../browser_tests/fixtures/customNode/typePairing'

export interface SupportedNodesPack {
  name: string
  version?: string
  node_labels?: Record<string, string[]>
}

export interface SupportedNodesDoc {
  labels: string[]
  node_packs: SupportedNodesPack[]
}

export type ObjectInfoSnapshot = Record<string, RawNodeDef>

const URL_PIN = /@[0-9a-f]{40}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.length > 0)
  )
}

// The parsed yaml is untrusted input (Cloud-ops-owned, refreshed by copy):
// validate every field the transform reads so a moved upstream schema fails
// here with a named reason, never as a malformed generated manifest.
export function validateSupportedNodesDoc(value: unknown): SupportedNodesDoc {
  if (!isRecord(value) || !isStringArray(value.labels))
    throw new Error(
      'supported_nodes.yaml: expected a top-level { labels, node_packs } document'
    )
  const declared = new Set(value.labels)
  if (!Array.isArray(value.node_packs))
    throw new Error('supported_nodes.yaml: node_packs must be a list')
  const packs = value.node_packs.map((pack, index): SupportedNodesPack => {
    if (!isRecord(pack) || typeof pack.name !== 'string' || pack.name === '')
      throw new Error(`supported_nodes.yaml: pack ${index} has no name`)
    const { name } = pack
    if (name.startsWith('http') && !URL_PIN.test(name))
      throw new Error(
        `supported_nodes.yaml: ${name} is URL-pinned but carries no @<40-hex-sha> suffix`
      )
    if (pack.version !== undefined && typeof pack.version !== 'string')
      throw new Error(`supported_nodes.yaml: ${name} version must be a string`)
    if (
      name !== 'core' &&
      !name.startsWith('http') &&
      (pack.version === undefined || pack.version === '')
    )
      throw new Error(
        `supported_nodes.yaml: registry pack ${name} has no version - deployRef needs one`
      )
    let nodeLabels: Record<string, string[]> | undefined
    if (pack.node_labels !== undefined) {
      if (!isRecord(pack.node_labels))
        throw new Error(
          `supported_nodes.yaml: ${name} node_labels must map node -> labels`
        )
      nodeLabels = {}
      for (const [node, labels] of Object.entries(pack.node_labels)) {
        if (!isStringArray(labels) || labels.length === 0)
          throw new Error(
            `supported_nodes.yaml: ${name} node ${node} must carry a non-empty label list`
          )
        if (new Set(labels).size !== labels.length)
          throw new Error(
            `supported_nodes.yaml: ${name} node ${node} carries a duplicate label`
          )
        for (const label of labels)
          if (!declared.has(label))
            throw new Error(
              `supported_nodes.yaml: ${name} node ${node} uses undeclared label ${label}`
            )
        nodeLabels[node] = labels
      }
    }
    return {
      name,
      version: typeof pack.version === 'string' ? pack.version : undefined,
      node_labels: nodeLabels
    }
  })
  if (packs.filter((pack) => pack.name === 'core').length > 1)
    throw new Error('supported_nodes.yaml: more than one core entry')
  return { labels: value.labels, node_packs: packs }
}

export function validateObjectInfoSnapshot(value: unknown): ObjectInfoSnapshot {
  if (!isRecord(value))
    throw new Error(
      'object_info snapshot: expected the raw /object_info shape (nodes keyed by class name)'
    )
  for (const [node, def] of Object.entries(value)) {
    if (!isRecord(def))
      throw new Error(`object_info snapshot: node ${node} is not an object`)
    if (
      def.python_module !== undefined &&
      typeof def.python_module !== 'string'
    )
      throw new Error(
        `object_info snapshot: node ${node} python_module is not a string`
      )
  }
  return value as ObjectInfoSnapshot
}

// The curated overlay is the ONE hand-maintained input to the generator
// (the generated .cloud.json stays machine-written): it attaches an authored
// run-tier workflow to a generated row. Keyed by the snapshot pack dirname
// (= the manifest row's `pack`), NOT the yaml pack name: URL-pinned yaml
// names embed the deploy sha and churn on every re-vendor, while the dirname
// is the identity every other hand-maintained suite surface (exclusion
// ledgers, geometry baselines) already keys on. `tiers` is the row's FULL
// replacement tier list; tier vocabulary is enforced by assertCloudEntry on
// every merged row.
interface CuratedCloudWorkflow {
  workflow: string
  tiers: CloudManifestEntry['tiers']
  timeoutMs?: number
}

export type CuratedCloudOverlay = Record<string, CuratedCloudWorkflow>

const OVERLAY_KEYS = ['workflow', 'tiers', 'timeoutMs']

export function validateCuratedCloudOverlay(
  value: unknown
): CuratedCloudOverlay {
  if (!isRecord(value))
    throw new Error(
      'curated overlay: expected { "<pack dirname>": { workflow, tiers[, timeoutMs] } }'
    )
  const overlay: CuratedCloudOverlay = {}
  for (const [pack, entry] of Object.entries(value)) {
    if (!isRecord(entry))
      throw new Error(`curated overlay: ${pack} must be an object`)
    // A typo'd key (say "timeout") would otherwise silently not apply.
    const unknown = Object.keys(entry).filter(
      (key) => !OVERLAY_KEYS.includes(key)
    )
    if (unknown.length > 0)
      throw new Error(
        `curated overlay: ${pack} carries unknown key(s) ${unknown.join(', ')} (allowed: ${OVERLAY_KEYS.join(', ')})`
      )
    if (typeof entry.workflow !== 'string' || entry.workflow === '')
      throw new Error(
        `curated overlay: ${pack} workflow must be a non-empty path relative to browser_tests/`
      )
    if (!isStringArray(entry.tiers) || entry.tiers.length === 0)
      throw new Error(
        `curated overlay: ${pack} tiers must be the row's full non-empty tier list`
      )
    if (
      entry.timeoutMs !== undefined &&
      (typeof entry.timeoutMs !== 'number' ||
        !Number.isFinite(entry.timeoutMs) ||
        entry.timeoutMs <= 0)
    )
      throw new Error(
        `curated overlay: ${pack} timeoutMs must be a positive number`
      )
    overlay[pack] = {
      workflow: entry.workflow,
      tiers: entry.tiers as CloudManifestEntry['tiers'],
      ...(entry.timeoutMs !== undefined ? { timeoutMs: entry.timeoutMs } : {})
    }
  }
  return overlay
}

// The yaml keys packs by registry id or git URL while the suite keys them by
// the custom_nodes/ directory name the snapshot reports - the two only agree
// up to case and separator style (comfyui-videohelpersuite vs
// ComfyUI-VideoHelperSuite), so both sides join on a lowercased alphanumeric
// key. Collisions abort: a wrong silent join would calibrate one pack against
// another pack's nodes.
function joinKeyOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function yamlJoinKeyOf(pack: SupportedNodesPack): string {
  if (!pack.name.startsWith('http')) return joinKeyOf(pack.name)
  const repo = pack.name
    .replace(URL_PIN, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
  return joinKeyOf(repo.slice(repo.lastIndexOf('/') + 1))
}

function deployRefOf(pack: SupportedNodesPack): string {
  if (pack.name.startsWith('http')) return pack.name
  return `${pack.name}@${pack.version}`
}

function sortedRecordOf(labelsByNode: Record<string, string[]>) {
  return Object.fromEntries(
    Object.keys(labelsByNode)
      .sort()
      .map((node) => [node, [...labelsByNode[node]].sort()])
  )
}

function snapshotPacksOf(snapshot: ObjectInfoSnapshot): Map<string, string[]> {
  const nodesByPack = new Map<string, string[]>()
  for (const [node, def] of Object.entries(snapshot)) {
    const pack = packOf(def.python_module)
    nodesByPack.set(pack, [...(nodesByPack.get(pack) ?? []), node])
  }
  return nodesByPack
}

export function buildCloudManifest(
  doc: SupportedNodesDoc,
  snapshot: ObjectInfoSnapshot,
  overlay: CuratedCloudOverlay = {}
): CloudManifest {
  const nodesByPack = snapshotPacksOf(snapshot)
  const dirnameByJoinKey = new Map<string, string>()
  for (const dirname of nodesByPack.keys()) {
    if (dirname === 'core') continue
    const key = joinKeyOf(dirname)
    const collision = dirnameByJoinKey.get(key)
    if (collision !== undefined)
      throw new Error(
        `snapshot packs ${collision} and ${dirname} collide on join key ${key}`
      )
    dirnameByJoinKey.set(key, dirname)
  }

  const unmatched: string[] = []
  const packs: CloudManifestEntry[] = []
  const seenYamlPacks = new Map<string, string>()
  for (const pack of doc.node_packs) {
    if (pack.name === 'core') continue
    const key = yamlJoinKeyOf(pack)
    const prior = seenYamlPacks.get(key)
    if (prior !== undefined)
      throw new Error(
        `yaml packs ${prior} and ${pack.name} collide on join key ${key}`
      )
    seenYamlPacks.set(key, pack.name)
    const dirname = dirnameByJoinKey.get(key)
    if (dirname === undefined) {
      unmatched.push(pack.name)
      continue
    }
    // Subtracting label-disabled nodes here encodes the 'vanish' reading of
    // the disabled-node semantics; CLOUD_DISABLED_SEMANTICS
    // (browser_tests/fixtures/customNode/cloudExclusions.ts) is the coupled
    // site - if the probe shows 'register-but-block', flip both together.
    const disabled = new Set(Object.keys(pack.node_labels ?? {}))
    const enabled = (nodesByPack.get(dirname) ?? [])
      .filter((node) => !disabled.has(node))
      .sort()
    if (enabled.length === 0)
      throw new Error(
        `pack ${dirname}: every snapshot node is label-disabled - nothing left to expect`
      )
    const curated = overlay[dirname]
    packs.push({
      pack: dirname,
      deployRef: deployRefOf(pack),
      tiers: curated?.tiers ?? ['load', 'connectivity'],
      workflow: curated?.workflow ?? '',
      expectedNodes: enabled.slice(0, 2),
      expectedNodeCount: enabled.length,
      // Unknowable from the two inputs: extension names come from a boot
      // probe of window.app.extensions (Phase-5 calibration fills them).
      expectedExtensions: [],
      disabledNodes: sortedRecordOf(pack.node_labels ?? {}),
      timeoutMs: curated?.timeoutMs ?? 30_000
    })
  }
  if (unmatched.length > 0)
    throw new Error(
      `yaml packs with no /object_info pack to join: ${unmatched.join(', ')} - ` +
        `either the snapshot predates their deploy or the dirname mapping rule broke`
    )
  // Zero rows would flow into a manifest that generates zero tests - the
  // fake-green class the loader also guards against.
  if (packs.length === 0)
    throw new Error(
      'no pack rows generated - the yaml contains no joinable non-core packs'
    )
  // Checked after the join errors so a broken join reds as itself, not as
  // its downstream orphan. An overlay key matching no generated row would
  // otherwise vanish silently - and with it the run tier it was meant to
  // enroll.
  const orphaned = Object.keys(overlay).filter(
    (pack) => !packs.some((row) => row.pack === pack)
  )
  if (orphaned.length > 0)
    throw new Error(
      `curated overlay pack(s) with no generated row to attach to: ` +
        `${orphaned.sort().join(', ')} - overlay keys must be snapshot pack ` +
        `dirnames; known packs: ${packs.map((row) => row.pack).join(', ')}`
    )

  packs.sort((a, b) => (a.pack < b.pack ? -1 : a.pack > b.pack ? 1 : 0))
  packs.forEach(assertCloudEntry)

  const core = doc.node_packs.find((pack) => pack.name === 'core')
  return {
    coreDisabledNodes: sortedRecordOf(core?.node_labels ?? {}),
    packs
  }
}

// Byte-identical output for identical inputs: rows and keys are sorted by the
// builder, key insertion order is fixed, and the file ends with one newline.
export function renderCloudManifest(manifest: CloudManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}
