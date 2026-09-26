import { fileURLToPath } from 'node:url'

import { fetchRolesForBuild } from '../src/utils/ashby'
import { readSnapshot, writeSnapshotIfChanged } from './snapshot-writer'

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

const totalRoles = outcome.snapshot.departments.reduce(
  (n, d) => n + d.roles.length,
  0
)

function countRoles(snapshot: Record<string, unknown> | null): number {
  const departments = snapshot?.departments
  if (!Array.isArray(departments)) return 0
  return departments.reduce(
    (n, d) => n + (Array.isArray(d?.roles) ? d.roles.length : 0),
    0
  )
}

// Every posting failing schema validation is reported as a successful fetch
// of zero roles, so an Ashby field rename would otherwise empty the careers
// page via a green PR.
if (totalRoles === 0 && countRoles(readSnapshot(snapshotPath)) > 0) {
  console.error(
    'Ashby returned no usable roles while the committed snapshot has some. ' +
      'That is a schema mismatch or an empty job board, not a refresh. ' +
      `Refusing to overwrite ${snapshotPath}; check apps/website/src/utils/ashby.schema.ts against the API.`
  )
  process.exit(1)
}

const wrote = writeSnapshotIfChanged(snapshotPath, outcome.snapshot)
process.stdout.write(
  wrote
    ? `Wrote snapshot with ${totalRoles} role(s) to ${snapshotPath}\n`
    : `No role changes; left ${snapshotPath} unchanged (${totalRoles} role(s)).\n`
)
