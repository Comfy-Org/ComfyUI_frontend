import { renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { fetchCloudNodesForBuild } from '../src/utils/cloudNodes'

const snapshotPath = fileURLToPath(
  new URL('../src/data/cloud-nodes.snapshot.json', import.meta.url)
)
const tempPath = `${snapshotPath}.tmp`

const outcome = await fetchCloudNodesForBuild()

if (outcome.status !== 'fresh') {
  const reason = 'reason' in outcome ? outcome.reason : '(none)'
  console.error(
    `Snapshot refresh aborted. Outcome: ${outcome.status}; reason: ${reason}`
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
