import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { expect, it } from 'vitest'

const workload = fileURLToPath(
  new URL('./telemetry-redaction-workload.ts', import.meta.url)
)

it.for([
  'dotted',
  'spaced',
  'multi-start-query',
  'multi-start-spaced',
  'quote-boundary-run',
  'glued-boundary-run',
  'glued-sibling-run',
  'collisions'
])(
  'bounds the %s telemetry workload in a cancellable process',
  { timeout: 15_000 },
  (kind) => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', workload, kind],
      { encoding: 'utf8', timeout: 10_000 }
    )

    expect({
      error: result.error,
      status: result.status,
      stderr: result.stderr,
      stdout: result.stdout
    }).toMatchObject({ error: undefined, status: 0 })
  }
)
