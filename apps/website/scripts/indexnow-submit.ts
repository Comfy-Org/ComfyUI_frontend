/**
 * Tells IndexNow engines (Bing, Yandex, Naver, Seznam, Yep) which sitemap URLs
 * a production deploy added, changed or removed. Always exits 0: a failed
 * ping is logged as a warning and must never fail the deploy.
 *
 *   tsx scripts/indexnow-submit.ts --current <manifest> \
 *     --previous <file> --previous-status <http code> [--dry-run]
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION
} from '@/config/indexnow'
import {
  diffManifests,
  indexNowPayloads,
  parseManifest,
  parsePreviousManifest
} from '@/lib/indexnow'

const { values } = parseArgs({
  options: {
    current: { type: 'string' },
    previous: { type: 'string' },
    'previous-status': { type: 'string' },
    'dry-run': { type: 'boolean', default: false }
  }
})

function report(line: string): void {
  process.stdout.write(`${line}\n`)
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary) appendFileSync(summary, `${line}\n`)
}

function warn(message: string): void {
  process.stdout.write(`::warning title=IndexNow::${message}\n`)
  report(`IndexNow skipped: ${message}`)
}

function readText(path: string | undefined): string {
  if (!path) return ''
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

async function keyFileIsLive(): Promise<boolean> {
  const response = await fetch(INDEXNOW_KEY_LOCATION)
  return response.ok && (await response.text()).trim() === INDEXNOW_KEY
}

async function main(): Promise<void> {
  const current = parseManifest(readText(values.current))
  if (!current) return warn(`no valid manifest at ${values.current}`)

  const previous = parsePreviousManifest(
    Number(values['previous-status']),
    readText(values.previous)
  )
  if (previous.kind === 'unavailable') return warn(previous.reason)

  const diff = diffManifests(
    previous.kind === 'found' ? previous.manifest : {},
    current
  )
  const urls = [...diff.added, ...diff.changed, ...diff.removed]
  report(
    `IndexNow: ${diff.added.length} added, ${diff.changed.length} changed, ${diff.removed.length} removed${previous.kind === 'first-run' ? ' (first run)' : ''}`
  )
  const payloads = indexNowPayloads(urls)

  if (values['dry-run']) {
    process.stdout.write(`${JSON.stringify(payloads, null, 2)}\n`)
    return report(`IndexNow dry run: ${payloads.length} request(s) not sent`)
  }
  if (payloads.length === 0) return
  if (!(await keyFileIsLive()))
    return warn(`key file ${INDEXNOW_KEY_LOCATION} does not serve the key`)

  for (const [index, payload] of payloads.entries()) {
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload)
    })
    const batch = `batch ${index + 1}/${payloads.length} (${payload.urlList.length} URLs)`
    if (response.status !== 200 && response.status !== 202)
      return warn(`${batch} returned HTTP ${response.status}`)
    report(`IndexNow ${batch}: HTTP ${response.status}`)
  }
}

try {
  await main()
} catch (error) {
  warn(error instanceof Error ? error.message : String(error))
}
