import { fileURLToPath } from 'node:url'

import { fetchCloudNodesForBuild } from '../src/utils/cloudNodes'
import { writeSnapshotIfChanged } from './snapshot-writer'

const snapshotPath = fileURLToPath(
  new URL('../src/data/cloud-nodes.snapshot.json', import.meta.url)
)

const outcome = await fetchCloudNodesForBuild()

if (outcome.status !== 'fresh') {
  const reason = 'reason' in outcome ? outcome.reason : '(none)'
  console.error(
    `Snapshot refresh aborted. Outcome: ${outcome.status}; reason: ${reason}`
  )
  process.exit(1)
}

const wrote = writeSnapshotIfChanged(snapshotPath, outcome.snapshot)
const totalNodes = outcome.snapshot.packs.reduce(
  (n, pack) => n + pack.nodes.length,
  0
)
const counts = `${outcome.snapshot.packs.length} pack(s) and ${totalNodes} node(s)`
process.stdout.write(
  wrote
    ? `Wrote snapshot with ${counts} to ${snapshotPath}\n`
    : `No node changes; left ${snapshotPath} unchanged (${counts}).\n`
)
