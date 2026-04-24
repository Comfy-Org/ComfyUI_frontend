#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { fetchRolesForBuild } from '../src/utils/ashby.ts'

const snapshotPath = fileURLToPath(
  new URL('../src/data/ashby-roles.snapshot.json', import.meta.url)
)

const outcome = await fetchRolesForBuild()

if (outcome.status !== 'fresh') {
  console.error(
    `Snapshot refresh aborted. Outcome: ${outcome.status}; reason: ${
      'reason' in outcome ? outcome.reason : '(none)'
    }`
  )
  process.exit(1)
}

writeFileSync(
  snapshotPath,
  JSON.stringify(outcome.snapshot, null, 2) + '\n',
  'utf8'
)
console.log(
  `Wrote snapshot with ${outcome.snapshot.departments.reduce(
    (n, d) => n + d.roles.length,
    0
  )} role(s) to ${snapshotPath}`
)
