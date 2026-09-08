import { readFileSync, writeFileSync } from 'node:fs'
import { posix, win32 } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parse } from 'yaml'

import { zComfyNodeDef } from '@comfyorg/object-info-parser'

import type {
  CloudManifest,
  CloudManifestEntry,
  CloudManifestSource
} from '../browser_tests/fixtures/customNode/manifest'
import { assertCloudEntry } from '../browser_tests/fixtures/customNode/manifest'
import type { RawNodeDef } from '../browser_tests/fixtures/customNode/typePairing'
import { packOf } from '../browser_tests/fixtures/customNode/typePairing'

export interface SupportedNodesPack {
  name: string
  version?: string
  node_labels?: Record<string, string[]>
  web_directory?: string
}

export interface SupportedNodesDoc {
  labels: string[]
  node_packs: SupportedNodesPack[]
}

export type ObjectInfoSnapshot = Record<string, RawNodeDef>

const URL_PIN = /@[0-9a-f]{40}$/
const SOURCE_LINE =
  /^# Source: (https:\/\/github\.com\/[^/]+\/[^/]+)\/blob\/([0-9a-f]{40})\/(\S+)$/m
const IMPORTED_LINE = /^# Imported: (\d{4}-\d{2}-\d{2})$/m

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.length > 0)
  )
}

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
      pack.web_directory !== undefined &&
      (typeof pack.web_directory !== 'string' ||
        !/^(?!.*(?:^|\/)\.\.(?:\/|$))[^/][A-Za-z0-9._/-]*$/.test(
          pack.web_directory
        ))
    )
      throw new Error(
        `supported_nodes.yaml: ${name} web_directory must be a safe relative path`
      )
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
      node_labels: nodeLabels,
      web_directory:
        typeof pack.web_directory === 'string' ? pack.web_directory : undefined
    }
  })
  if (packs.filter((pack) => pack.name === 'core').length > 1)
    throw new Error('supported_nodes.yaml: more than one core entry')
  return { labels: value.labels, node_packs: packs }
}

export function sourceFromSupportedNodesHeader(
  contents: string
): CloudManifestSource {
  const source = SOURCE_LINE.exec(contents)
  const imported = IMPORTED_LINE.exec(contents)
  if (!source || !imported)
    throw new Error(
      'supported_nodes.yaml: expected pinned # Source and # Imported headers'
    )
  const importedAt = imported[1]
  const timestamp = Date.parse(`${importedAt}T00:00:00Z`)
  if (
    Number.isNaN(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== importedAt
  )
    throw new Error('supported_nodes.yaml: # Imported must be a real ISO date')
  return {
    repository: source[1],
    ref: source[2],
    path: source[3],
    importedAt
  }
}

export function validateObjectInfoSnapshot(value: unknown): ObjectInfoSnapshot {
  if (!isRecord(value))
    throw new Error(
      'object_info snapshot: expected the raw /object_info shape (nodes keyed by class name)'
    )
  const snapshot: ObjectInfoSnapshot = {}
  for (const [node, def] of Object.entries(value)) {
    const parsed = zComfyNodeDef.safeParse(def)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const path = issue?.path.length ? `.${issue.path.join('.')}` : ''
      throw new Error(
        `object_info snapshot: node ${node}${path} ${issue?.message ?? 'is invalid'}`
      )
    }
    snapshot[node] = parsed.data
  }
  return snapshot
}

interface CuratedCloudWorkflow {
  workflow: string
  tiers: CloudManifestEntry['tiers']
  expectedNodes?: string[]
  expectedRunnableCount?: number
  expectedRunnableNodeTypesSha256?: string
  timeoutMs?: number
}

export type CuratedCloudOverlay = Record<string, CuratedCloudWorkflow>

const OVERLAY_KEYS = [
  'workflow',
  'tiers',
  'expectedNodes',
  'expectedRunnableCount',
  'expectedRunnableNodeTypesSha256',
  'timeoutMs'
]

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
    if (
      posix.isAbsolute(entry.workflow) ||
      win32.isAbsolute(entry.workflow) ||
      entry.workflow.split(/[\\/]/).includes('..')
    )
      throw new Error(
        `curated overlay: ${pack} workflow must stay inside browser_tests/`
      )
    if (!isStringArray(entry.tiers) || entry.tiers.length === 0)
      throw new Error(
        `curated overlay: ${pack} tiers must be the row's full non-empty tier list`
      )
    if (!entry.tiers.includes('run'))
      throw new Error(`curated overlay: ${pack} tiers must include 'run'`)
    if (
      entry.expectedNodes !== undefined &&
      (!isStringArray(entry.expectedNodes) ||
        entry.expectedNodes.length === 0 ||
        new Set(entry.expectedNodes).size !== entry.expectedNodes.length)
    )
      throw new Error(
        `curated overlay: ${pack} expectedNodes must be a non-empty array of unique non-empty node keys`
      )
    if (
      !Number.isInteger(entry.expectedRunnableCount) ||
      (entry.expectedRunnableCount as number) <= 0
    )
      throw new Error(
        `curated overlay: ${pack} expectedRunnableCount must be a positive integer`
      )
    if (!/^[0-9a-f]{64}$/.test(String(entry.expectedRunnableNodeTypesSha256)))
      throw new Error(
        `curated overlay: ${pack} expectedRunnableNodeTypesSha256 must be a sha256 digest`
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
      ...(entry.expectedNodes !== undefined
        ? { expectedNodes: entry.expectedNodes }
        : {}),
      expectedRunnableCount: entry.expectedRunnableCount as number,
      expectedRunnableNodeTypesSha256:
        entry.expectedRunnableNodeTypesSha256 as string,
      ...(entry.timeoutMs !== undefined ? { timeoutMs: entry.timeoutMs } : {})
    }
  }
  return overlay
}

// yaml pack ids and snapshot dirnames agree only up to case and separators.
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

// One boot-registered extension name per pack, read off the JS Cloud actually
// serves at /extensions/. One sentinel, not the full set: the assert only has
// to prove the pack's JS loaded, and a conditionally-registered extra would
// red a healthy run.
export type CloudExtensionSentinels = Record<string, string[]>

export function validateCloudExtensionSentinels(
  value: unknown
): CloudExtensionSentinels {
  if (!isRecord(value))
    throw new Error(
      'cloudExtensionSentinels: expected { "<pack dirname>": ["<extension>", ...] }'
    )
  const sidecar: CloudExtensionSentinels = {}
  for (const [pack, extensions] of Object.entries(value)) {
    if (
      !isStringArray(extensions) ||
      extensions.length === 0 ||
      new Set(extensions).size !== extensions.length
    )
      throw new Error(
        `cloudExtensionSentinels: ${pack} must be a non-empty array of unique non-empty extension names`
      )
    sidecar[pack] = [...extensions].sort()
  }
  return sidecar
}

// Per-pack auto-run calibration (nodes that cannot execute on pure defaults
// against the cloud backend), carried as a sidecar so regeneration preserves
// it. Calibrated from gate-run failure details, not authored by hand.
export type CloudCannotRunAlone = Record<string, string[]>

export function validateCloudCannotRunAlone(
  value: unknown
): CloudCannotRunAlone {
  if (!isRecord(value))
    throw new Error(
      'cloudCannotRunAlone: expected { "<pack dirname>": ["<node key>", ...] }'
    )
  const sidecar: CloudCannotRunAlone = {}
  for (const [pack, keys] of Object.entries(value)) {
    if (
      !isStringArray(keys) ||
      keys.length === 0 ||
      keys.some((key) => key === '') ||
      new Set(keys).size !== keys.length
    )
      throw new Error(
        `cloudCannotRunAlone: ${pack} must be a non-empty array of unique non-empty node keys`
      )
    sidecar[pack] = [...keys].sort()
  }
  return sidecar
}

export function buildCloudManifest(
  doc: SupportedNodesDoc,
  snapshot: ObjectInfoSnapshot,
  source: CloudManifestSource,
  overlay: CuratedCloudOverlay = {},
  sentinels: CloudExtensionSentinels = {},
  cannotRunAlone: CloudCannotRunAlone = {}
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
    // Assumes 'vanish' semantics - flip with CLOUD_DISABLED_SEMANTICS (cloudExclusions.ts).
    const disabled = new Set(Object.keys(pack.node_labels ?? {}))
    const enabled = (nodesByPack.get(dirname) ?? [])
      .filter((node) => !disabled.has(node))
      .sort()
    if (enabled.length === 0)
      throw new Error(
        `pack ${dirname}: every snapshot node is label-disabled - nothing left to expect`
      )
    const curated = overlay[dirname]
    // The default two sentinels are alphabetical, so a run-tier pack's load
    // tier can end up asserting nodes its curated workflow never opens. The
    // overlay may name the workflow's own nodes instead; they must still be
    // nodes this env registers.
    const offEnabled = (curated?.expectedNodes ?? []).filter(
      (node) => !enabled.includes(node)
    )
    if (offEnabled.length > 0)
      throw new Error(
        `curated overlay: ${dirname} expectedNodes ${offEnabled.sort().join(', ')} ` +
          `are not enabled nodes of the pack - they must be snapshot nodes the ` +
          `deployment leaves label-enabled`
      )
    packs.push({
      pack: dirname,
      deployRef: deployRefOf(pack),
      tiers: curated?.tiers ?? ['load', 'connectivity'],
      workflow: curated?.workflow ?? '',
      expectedNodes: curated?.expectedNodes ?? enabled.slice(0, 2),
      ...(curated
        ? {
            expectedRunnableCount: curated.expectedRunnableCount,
            expectedRunnableNodeTypesSha256:
              curated.expectedRunnableNodeTypesSha256
          }
        : {}),
      expectedNodeCount: enabled.length,
      expectedExtensions: sentinels[dirname] ?? [],
      disabledNodes: sortedRecordOf(pack.node_labels ?? {}),
      ...(pack.web_directory !== undefined
        ? { webDirectory: pack.web_directory }
        : {}),
      timeoutMs: curated?.timeoutMs ?? 30_000,
      ...(curated && cannotRunAlone[dirname]
        ? { cannotRunAlone: cannotRunAlone[dirname] }
        : {})
    })
  }
  // A yaml pack with no snapshot nodes gets recorded, not thrown on: it would
  // otherwise block every other pack's row. The snapshot cannot say WHY it is
  // empty (the pack registers nothing, or the dirname rule broke), so the list
  // ships in the manifest for review instead of being silently dropped.
  if (unmatched.length > packs.length)
    throw new Error(
      `${unmatched.length} yaml packs have no /object_info pack to join but only ` +
        `${packs.length} joined - the dirname mapping rule has broken, not a few ` +
        `empty packs: ${unmatched.slice(0, 10).join(', ')}`
    )
  if (packs.length === 0)
    throw new Error(
      'no pack rows generated - the yaml contains no joinable non-core packs'
    )
  const orphaned = Object.keys(overlay).filter(
    (pack) => !packs.some((row) => row.pack === pack)
  )
  if (orphaned.length > 0)
    throw new Error(
      `curated overlay pack(s) with no generated row to attach to: ` +
        `${orphaned.sort().join(', ')} - overlay keys must be snapshot pack ` +
        `dirnames; known packs: ${packs.map((row) => row.pack).join(', ')}`
    )
  const orphanedCalibration = Object.keys(cannotRunAlone).filter(
    (pack) => !packs.some((row) => row.pack === pack)
  )
  if (orphanedCalibration.length > 0)
    throw new Error(
      `cloudCannotRunAlone pack(s) with no generated row to attach to: ` +
        `${orphanedCalibration.sort().join(', ')} - keys must be snapshot pack dirnames`
    )
  const orphanedSentinels = Object.keys(sentinels).filter(
    (pack) => !packs.some((row) => row.pack === pack)
  )
  if (orphanedSentinels.length > 0)
    throw new Error(
      `cloudExtensionSentinels pack(s) with no generated row to attach to: ` +
        `${orphanedSentinels.sort().join(', ')} - keys must be snapshot pack dirnames`
    )

  packs.sort((a, b) => (a.pack < b.pack ? -1 : a.pack > b.pack ? 1 : 0))
  packs.forEach(assertCloudEntry)

  const core = doc.node_packs.find((pack) => pack.name === 'core')
  return {
    source,
    coreDisabledNodes: sortedRecordOf(core?.node_labels ?? {}),
    packs,
    unjoinedYamlPacks: unmatched.sort()
  }
}

export function renderCloudManifest(manifest: CloudManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

function dataPath(name: string): string {
  return fileURLToPath(
    new URL(`../browser_tests/fixtures/data/${name}`, import.meta.url)
  )
}

function generate(snapshotPath: string): void {
  const yamlPath = dataPath('cloud/supported_nodes.yaml')
  const manifestPath = dataPath('customNodeManifest.cloud.json')
  const yamlContents = readFileSync(yamlPath, 'utf8')
  const snapshotValue: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'))
  const overlay: unknown = JSON.parse(
    readFileSync(dataPath('cloud/curatedWorkflows.json'), 'utf8')
  )
  const sentinels: unknown = JSON.parse(
    readFileSync(dataPath('cloud/extensionSentinels.json'), 'utf8')
  )
  const cannotRunAlone: unknown = JSON.parse(
    readFileSync(dataPath('cloud/cannotRunAlone.json'), 'utf8')
  )
  const manifest = buildCloudManifest(
    validateSupportedNodesDoc(parse(yamlContents)),
    validateObjectInfoSnapshot(snapshotValue),
    sourceFromSupportedNodesHeader(yamlContents),
    validateCuratedCloudOverlay(overlay),
    validateCloudExtensionSentinels(sentinels),
    validateCloudCannotRunAlone(cannotRunAlone)
  )
  writeFileSync(manifestPath, renderCloudManifest(manifest))
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  const snapshotPath = process.argv[2]
  if (snapshotPath === undefined) {
    process.stderr.write(
      'usage: pnpm gen:cloud-manifest <object-info-snapshot.json>\n'
    )
    process.exitCode = 1
  } else {
    generate(snapshotPath)
  }
}
