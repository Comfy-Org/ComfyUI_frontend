import { fileURLToPath } from 'node:url'

import { fetchRolesForBuild } from '../src/utils/ashby'
import { writeSnapshotIfChanged } from './snapshot-writer'

const snapshotPath = fileURLToPath(
  new URL('../src/data/ashby-roles.snapshot.json', import.meta.url)
)

const outcome = await fetchRolesForBuild()

if (outcome.status !== 'fresh') {
  const reason = 'reason' in outcome ? outcome.reason : '(none)'
  console.error(
    `Snapshot refresh aborted. Outcome: ${outcome.status}; reason: ${reason}`
  )
  process.exit(1)
}

const wrote = writeSnapshotIfChanged(snapshotPath, outcome.snapshot)
const totalRoles = outcome.snapshot.departments.reduce(
  (n, d) => n + d.roles.length,
  0
)
process.stdout.write(
  wrote
    ? `Wrote snapshot with ${totalRoles} role(s) to ${snapshotPath}\n`
    : `No role changes; left ${snapshotPath} unchanged (${totalRoles} role(s)).\n`
)
