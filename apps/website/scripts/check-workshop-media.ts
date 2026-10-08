/** Fail a website build if its Workshop overlay references missing local media. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { workshopDisplayEntriesSchema } from '@/content/workshop-display.schema'
import { findMissingLocalWorkshopMedia } from '@/lib/workshop/local-media-files'

const websiteRoot = process.cwd()
const entries = workshopDisplayEntriesSchema.parse(
  JSON.parse(
    readFileSync(join(websiteRoot, 'src/content/workshop-display.json'), 'utf8')
  )
)
const missing = findMissingLocalWorkshopMedia(
  entries,
  join(websiteRoot, 'public')
)

if (missing.length > 0) {
  console.error(
    `[workshop-media] ${missing.length} missing or unsafe local media URL(s):`
  )
  for (const problem of missing) console.error(`  ${problem}`)
  process.exit(1)
}

console.log('[workshop-media] local thumbnail, poster and sample paths valid.')
// External CDN URLs are not checked: they require a separate network audit.
