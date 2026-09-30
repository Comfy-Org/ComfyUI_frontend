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
// page via a green PR. A genuinely empty board reports zero roles too — what
// separates them is whether anything was dropped on the way.
if (
  totalRoles === 0 &&
  outcome.droppedCount > 0 &&
  countRoles(readSnapshot(snapshotPath)) > 0
) {
  const dropped = outcome.droppedRoles
    .map((role) => `  - ${role.title || '(untitled)'}: ${role.reason}`)
    .join('\n')
  console.error(
    `Ashby returned no usable roles and dropped ${outcome.droppedCount}, while the committed snapshot has some.\n` +
      `${dropped}\n` +
      `That is a schema mismatch, not an empty board. Refusing to overwrite ${snapshotPath}; ` +
      'check apps/website/src/utils/ashby.schema.ts against the API.'
  )
  process.exit(1)
}

const wrote = writeSnapshotIfChanged(snapshotPath, outcome.snapshot)
process.stdout.write(
  wrote
    ? `Wrote snapshot with ${totalRoles} role(s) to ${snapshotPath}\n`
    : `No role changes; left ${snapshotPath} unchanged (${totalRoles} role(s)).\n`
)
