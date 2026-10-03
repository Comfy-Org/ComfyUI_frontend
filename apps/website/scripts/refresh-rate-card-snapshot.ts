import { renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { findRateCardProblems } from '@/data/rateCardChecks'
import { zRateCard } from '@/types/rate-card/zod.gen'

const RATE_CARD_URL = 'https://platformapi.comfy.org/deploy/v1/rate-card'

const snapshotPath = fileURLToPath(
  new URL('../src/data/rate-card.snapshot.json', import.meta.url)
)
const tempPath = `${snapshotPath}.tmp`

const response = await fetch(RATE_CARD_URL, {
  headers: { Accept: 'application/json' }
})
if (!response.ok) {
  console.error(
    `Snapshot refresh aborted. GET ${RATE_CARD_URL} returned HTTP ${response.status} ${response.statusText}`
  )
  process.exit(1)
}

const result = zRateCard.safeParse(await response.json())
if (!result.success) {
  console.error(
    `Snapshot refresh aborted. Response failed schema validation: ${result.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ')}`
  )
  process.exit(1)
}

// Schema-valid doesn't mean render-safe: PricingSection throws if a storage
// entry has no label mapping or the worked example's rate is missing.
const problems = findRateCardProblems(result.data)
if (problems.length > 0) {
  console.error(
    `Snapshot refresh aborted. Response would break the pricing page: ${problems.join('; ')}`
  )
  process.exit(1)
}

writeFileSync(tempPath, JSON.stringify(result.data, null, 2) + '\n', 'utf8')
renameSync(tempPath, snapshotPath)

process.stdout.write(
  `Wrote snapshot with ${result.data.gpus.length} GPU rate(s) and ${result.data.storage.length} storage rate(s) to ${snapshotPath}\n`
)
