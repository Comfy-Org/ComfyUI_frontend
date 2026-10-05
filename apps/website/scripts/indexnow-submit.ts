/**
 * Tells IndexNow engines (Bing, Yandex, Naver, Seznam, Yep) which sitemap URLs
 * a production deploy added, changed or removed. Always exits 0: a failed
 * ping is logged as a warning and must never fail the deploy.
 *
 *   pnpm indexnow:submit --current <manifest> \
 *     --previous <file> --previous-status <http code> [--dry-run]
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION
} from '@/config/indexnow'
import type { IndexNowPayload } from '@/lib/indexnow'
import { planSubmission } from '@/lib/indexnow'

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

async function send(payloads: IndexNowPayload[]): Promise<void> {
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

async function main(): Promise<void> {
  const plan = planSubmission(
    readText(values.current),
    Number(values['previous-status']),
    readText(values.previous)
  )
  if (plan.kind === 'skip') return warn(plan.reason)
  report(plan.summary)

  if (values['dry-run']) {
    process.stdout.write(`${JSON.stringify(plan.payloads, null, 2)}\n`)
    return report(
      `IndexNow dry run: ${plan.payloads.length} request(s) not sent`
    )
  }
  if (plan.payloads.length === 0) return
  if (!(await keyFileIsLive()))
    return warn(`key file ${INDEXNOW_KEY_LOCATION} does not serve the key`)
  await send(plan.payloads)
}

try {
  await main()
} catch (error) {
  warn(error instanceof Error ? error.message : String(error))
}
