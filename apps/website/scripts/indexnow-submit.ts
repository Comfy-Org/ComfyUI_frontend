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

const REQUEST_TIMEOUT_MS = 30_000

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
  const response = await fetch(INDEXNOW_KEY_LOCATION, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  const body = await response.text()
  return response.ok && body.trim() === INDEXNOW_KEY
}

const ACCEPTED = new Set([200, 202])

async function postBatch(
  payload: IndexNowPayload,
  label: string
): Promise<boolean> {
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  await response.body?.cancel()
  const accepted = ACCEPTED.has(response.status)
  const line = `${label} (${payload.urlList.length} URLs): HTTP ${response.status}`
  if (accepted) report(`IndexNow ${line}`)
  else warn(line)
  return accepted
}

async function postAll(payloads: IndexNowPayload[]): Promise<void> {
  for (const [index, payload] of payloads.entries()) {
    if (!(await postBatch(payload, `batch ${index + 1}/${payloads.length}`)))
      return
  }
}

async function send(payloads: IndexNowPayload[]): Promise<void> {
  if (payloads.length === 0) return
  if (await keyFileIsLive()) return postAll(payloads)
  warn(`key file ${INDEXNOW_KEY_LOCATION} does not serve the key`)
}

function preview(payloads: IndexNowPayload[]): void {
  process.stdout.write(`${JSON.stringify(payloads, null, 2)}\n`)
  report(`IndexNow dry run: ${payloads.length} request(s) not sent`)
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      current: { type: 'string' },
      previous: { type: 'string' },
      'previous-status': { type: 'string' },
      'dry-run': { type: 'boolean', default: false }
    }
  })
  const plan = planSubmission(
    readText(values.current),
    Number(values['previous-status']),
    readText(values.previous)
  )
  if (plan.kind === 'skip') return warn(plan.reason)
  report(plan.summary)
  if (values['dry-run']) return preview(plan.payloads)
  await send(plan.payloads)
}

try {
  await main()
} catch (error) {
  warn(error instanceof Error ? error.message : String(error))
}
