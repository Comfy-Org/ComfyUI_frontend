import { fileURLToPath } from 'node:url'

import { fetchCloudNodesForBuild } from '../src/utils/cloudNodes'
import { readSnapshot, writeSnapshotIfChanged } from './snapshot-writer'

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

function enrichedPackIds(
  snapshot: Record<string, unknown> | null
): Set<string> {
  const packs = snapshot?.packs
  if (!Array.isArray(packs)) return new Set()
  return new Set(
    packs
      .filter(
        (pack): pack is { id: string; registryId: string } =>
          typeof pack?.id === 'string' && typeof pack?.registryId === 'string'
      )
      .map((pack) => pack.id)
  )
}

// A registry outage is not an exception: fetchRegistryPacks answers with an
// empty map, every pack silently loses its description, repo, publisher and
// version, and the outcome is still 'fresh'. Unattended, that would land as a
// green PR deleting metadata for two thirds of the packs, so compare against
// what is already on disk and refuse rather than write the loss.
const previouslyEnriched = enrichedPackIds(readSnapshot(snapshotPath))
const nowEnriched = enrichedPackIds({ packs: outcome.snapshot.packs })
const stillPresent = new Set(outcome.snapshot.packs.map((pack) => pack.id))
const lost = [...previouslyEnriched].filter(
  (id) => stillPresent.has(id) && !nowEnriched.has(id)
)

if (lost.length > 0) {
  console.error(
    `Registry metadata regressed: ${lost.length} pack(s) still present lost their registry data ` +
      `(${lost.slice(0, 5).join(', ')}${lost.length > 5 ? ', …' : ''}). ` +
      'This is what a degraded registry API looks like — it reports success with empty results. ' +
      `Refusing to overwrite ${snapshotPath}; re-run once the registry is healthy.`
  )
  process.exit(1)
}

const wrote = writeSnapshotIfChanged(snapshotPath, outcome.snapshot, [
  'downloads',
  'githubStars'
])
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
