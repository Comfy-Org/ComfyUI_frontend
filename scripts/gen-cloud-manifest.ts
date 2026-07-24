// Generates browser_tests/fixtures/data/customNodeManifest.cloud.json - the
// cloud custom-nodes suite calibration - by joining Cloud's supported node
// list with a Cloud /object_info snapshot. Deterministic: identical inputs
// produce a byte-identical file, so recalibration after a Cloud deploy is
// regenerate-and-diff, never hand-editing.
//
// Usage: pnpm gen:cloud-manifest <object-info-snapshot.json> \
//   [supported-nodes.yaml] [output.json]
//
// The snapshot argument is an authenticated /object_info capture from the
// Cloud test instance (the Phase-1 probe output).
//
// When browser_tests/fixtures/data/cloud/curatedCloudWorkflows.json exists
// it is applied as the curated overlay: the ONE hand-maintained generator
// input, attaching authored run-tier workflows (workflow path + full tier
// list, optional timeoutMs) to generated rows by snapshot pack dirname. Cloud
// run-tier enrollment comes only from this overlay.
//
// Vendored input provenance: browser_tests/fixtures/data/cloud/
// supported_nodes.yaml is a byte-exact copy of Comfy-Org/cloud
// comfy-complete/supported_nodes.yaml, fetched 2026-07-21. Refresh by
// copying the upstream file verbatim - never edit the vendored copy
// (upstream diffs must stay clean; .oxfmtrc.json ignores it so the
// formatter cannot rewrite it either).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'yaml'

import {
  buildCloudManifest,
  renderCloudManifest,
  validateCuratedCloudOverlay,
  validateObjectInfoSnapshot,
  validateSupportedNodesDoc
} from './cloud-manifest'

const DEFAULT_SUPPORTED_NODES =
  'browser_tests/fixtures/data/cloud/supported_nodes.yaml'
const DEFAULT_OUTPUT =
  'browser_tests/fixtures/data/customNodeManifest.cloud.json'
const CURATED_OVERLAY =
  'browser_tests/fixtures/data/cloud/curatedCloudWorkflows.json'

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
const manifest = buildCloudManifest(doc, snapshot, overlay)
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
