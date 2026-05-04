import { renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { NodesSnapshot, Pack, PackNode } from '../src/data/cloudNodes'

import { fetchCloudNodesForBuild } from '../src/utils/cloudNodes'

const snapshotPath = fileURLToPath(
  new URL('../src/data/cloud-nodes.snapshot.json', import.meta.url)
)
const tempPath = `${snapshotPath}.tmp`

const userContentExtensionRegex =
  /\.(png|jpe?g|webp|gif|mp4|mov|webm|wav|mp3|flac|ogg|safetensors|ckpt|pt)$/i

function findUserContentLeak(snapshot: NodesSnapshot): string | null {
  for (const pack of snapshot.packs) {
    const packLeak = checkPack(pack)
    if (packLeak) return packLeak
  }
  return null
}

function checkPack(pack: Pack): string | null {
  const stringFields: Array<readonly [keyof Pack, string | undefined]> = [
    ['displayName', pack.displayName],
    ['description', pack.description],
    ['repoUrl', pack.repoUrl]
  ]
  for (const [field, value] of stringFields) {
    if (value && userContentExtensionRegex.test(value)) {
      return `pack ${pack.id}.${String(field)}=${value}`
    }
  }
  for (const node of pack.nodes) {
    const nodeLeak = checkNode(pack.id, node)
    if (nodeLeak) return nodeLeak
  }
  return null
}

function checkNode(packId: string, node: PackNode): string | null {
  const stringFields: Array<readonly [keyof PackNode, string | undefined]> = [
    ['displayName', node.displayName],
    ['description', node.description]
  ]
  for (const [field, value] of stringFields) {
    if (value && userContentExtensionRegex.test(value)) {
      return `pack ${packId} node ${node.name}.${String(field)}=${value}`
    }
  }
  return null
}

const outcome = await fetchCloudNodesForBuild()

if (outcome.status !== 'fresh') {
  const reason = 'reason' in outcome ? outcome.reason : '(none)'
  console.error(
    `Snapshot refresh aborted. Outcome: ${outcome.status}; reason: ${reason}`
  )
  process.exit(1)
}

const leak = findUserContentLeak(outcome.snapshot)
if (leak) {
  console.error(
    `Snapshot refresh aborted. Detected possible user-content filename: ${leak}`
  )
  process.exit(1)
}

const serialized = JSON.stringify(outcome.snapshot, null, 2) + '\n'

writeFileSync(tempPath, serialized, 'utf8')
renameSync(tempPath, snapshotPath)

const totalNodes = outcome.snapshot.packs.reduce(
  (n, pack) => n + pack.nodes.length,
  0
)
process.stdout.write(
  `Wrote snapshot with ${outcome.snapshot.packs.length} pack(s) and ${totalNodes} node(s) to ${snapshotPath}\n`
)
