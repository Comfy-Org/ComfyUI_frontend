import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'yaml'

import {
  buildCloudManifest,
  renderCloudManifest,
  validateCuratedCloudOverlay,
  validateObjectInfoSnapshot,
  validateSupportedNodesDoc
} from './cloud-manifest'

// Byte-exact vendored copy of Comfy-Org/cloud comfy-complete/supported_nodes.yaml; refresh by verbatim copy, never edit.
const DEFAULT_SUPPORTED_NODES =
  'browser_tests/fixtures/data/cloud/supported_nodes.yaml'
const DEFAULT_OUTPUT =
  'browser_tests/fixtures/data/customNodeManifest.cloud.json'
const CURATED_OVERLAY =
  'browser_tests/fixtures/data/cloud/curatedCloudWorkflows.json'
const EXTENSION_SENTINELS =
  'browser_tests/fixtures/data/cloud/cloudExtensionSentinels.json'

const [snapshotPath, supportedNodesPath, outputPath] = process.argv.slice(2)
if (!snapshotPath) {
  console.error(
    'usage: pnpm gen:cloud-manifest <object-info-snapshot.json> ' +
      `[supported-nodes.yaml=${DEFAULT_SUPPORTED_NODES}] [output.json=${DEFAULT_OUTPUT}]; ` +
      `applies the curated run-tier overlay ${CURATED_OVERLAY} when present`
  )
  process.exit(1)
}

const doc = validateSupportedNodesDoc(
  parse(readFileSync(supportedNodesPath ?? DEFAULT_SUPPORTED_NODES, 'utf-8'))
)
const snapshot = validateObjectInfoSnapshot(
  JSON.parse(readFileSync(snapshotPath, 'utf-8'))
)
const overlay = existsSync(CURATED_OVERLAY)
  ? validateCuratedCloudOverlay(
      JSON.parse(readFileSync(CURATED_OVERLAY, 'utf-8'))
    )
  : {}
const sentinels = existsSync(EXTENSION_SENTINELS)
  ? (JSON.parse(readFileSync(EXTENSION_SENTINELS, 'utf-8')) as Record<
      string,
      string[]
    >)
  : {}
const manifest = buildCloudManifest(doc, snapshot, overlay, sentinels)
const target = outputPath ?? DEFAULT_OUTPUT
writeFileSync(target, renderCloudManifest(manifest))
const runEnrolled = manifest.packs.filter((row) =>
  row.tiers.includes('run')
).length
console.warn(
  `${target}: ${manifest.packs.length} pack rows ` +
    `(${runEnrolled} run-enrolled via ${CURATED_OVERLAY}), ` +
    `${Object.keys(manifest.coreDisabledNodes).length} core-disabled nodes`
)
