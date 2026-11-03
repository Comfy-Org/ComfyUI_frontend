import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { buildInventory, compareBaseline } from './inventory'

const repositoryRoot = path.resolve(import.meta.dirname, '../../..')
const baselinePath = path.resolve(import.meta.dirname, '../baseline.json')

async function main(): Promise<number> {
  const { errors, liveDefects, infrastructure } = compareBaseline(
    await buildInventory(repositoryRoot),
    JSON.parse(await readFile(baselinePath, 'utf8'))
  )

  if (errors.length === 0) {
    process.stdout.write(
      `Expected-failure baseline matches: ${liveDefects} live defects, ${infrastructure} infrastructure assertions.\n`
    )
    return 0
  }

  for (const error of errors) console.error(error)
  console.error(
    'Update tools/expected-failures/baseline.json: remove resolved entries and classify each addition as "live-defect" or "infrastructure-assertion".'
  )
  return 1
}

if (import.meta.main) process.exitCode = await main()
