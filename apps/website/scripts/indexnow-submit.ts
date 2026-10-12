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

import type { IndexNowPayload, SendNote } from '@/lib/indexnow'
import { planSubmission, sendPayloads } from '@/lib/indexnow'

function report(line: string): void {
  process.stdout.write(`${line}\n`)
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary) appendFileSync(summary, `${line}\n`)
}

function log({ level, line }: SendNote): void {
  if (level === 'warn')
    process.stdout.write(`::warning title=IndexNow::${line}\n`)
  report(line)
}

function warn(message: string): void {
  log({ level: 'warn', line: `IndexNow skipped: ${message}` })
}

function readText(path: string | undefined): string {
  if (!path) return ''
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
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
  await sendPayloads(plan.payloads, { fetch, log })
}

try {
  await main()
} catch (error) {
  warn(error instanceof Error ? error.message : String(error))
}
