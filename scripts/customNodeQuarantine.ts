/**
 * Checks that every quarantined pack is still broken.
 *
 * Quarantine removes a pack from the population, so it is lost coverage that
 * looks like a green run. The only thing that makes it safe is this: each
 * entry is re-checked against the live world, and an entry whose bug has been
 * fixed upstream FAILS - the same discipline the manifest already applies to
 * cannotRunAlone and the pack ledgers, where an unlisted failure is a
 * regression and a listed clean run is a stale entry.
 *
 *   pnpm custom-node-quarantine
 */
import { execFile } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import type { QuarantinedPack } from '../browser_tests/fixtures/customNode/manifest'
import {
  MAX_QUARANTINED_PACKS,
  loadFullManifest,
  loadPackQuarantine,
  packIdentity
} from '../browser_tests/fixtures/customNode/manifest'

const run = promisify(execFile)

const say = (line: string) => process.stdout.write(`${line}\n`)

async function refStillMissing(deployRef: string): Promise<boolean> {
  const [url, sha] = deployRef.split(/@(?=[^@]*$)/)
  if (!url || !sha) return true
  try {
    const { stdout } = await run('git', ['ls-remote', url, sha], {
      timeout: 60_000
    })
    if (stdout.trim()) return false
  } catch {
    // ls-remote only matches advertised refs; a reachable commit still needs
    // the fetch probe below before concluding anything.
  }
  const dir = mkdtempSync(join(tmpdir(), 'cnq-'))
  try {
    await run('git', ['init', '-q', dir], { timeout: 30_000 })
    await run('git', ['-C', dir, 'remote', 'add', 'origin', url])
    await run('git', ['-C', dir, 'fetch', '--depth', '1', 'origin', sha], {
      timeout: 90_000
    })
    return false
  } catch {
    return true
  }
}

async function requirementsStillUnsatisfiable(
  deployRef: string
): Promise<boolean> {
  const [url, sha] = deployRef.split(/@(?=[^@]*$)/)
  const slug = url?.split('github.com/')[1]
  if (!slug || !sha) return true
  let body: string
  try {
    const { stdout } = await run('curl', [
      '-sfL',
      '--max-time',
      '30',
      `https://raw.githubusercontent.com/${slug}/${sha}/requirements.txt`
    ])
    body = stdout
  } catch {
    return true
  }
  const dir = mkdtempSync(join(tmpdir(), 'cnq-'))
  const file = join(dir, 'requirements.txt')
  writeFileSync(file, body)
  try {
    await run(
      'python3',
      ['-m', 'pip', 'install', '--dry-run', '--quiet', '-r', file],
      { timeout: 300_000 }
    )
    return false
  } catch {
    return true
  }
}

async function stillBroken(
  pack: string,
  entry: QuarantinedPack,
  deployRef: string
): Promise<boolean> {
  switch (entry.class) {
    case 'unfetchable-ref':
      return refStillMissing(deployRef)
    case 'unsatisfiable-requirement':
      return requirementsStillUnsatisfiable(deployRef)
    default:
      throw new Error(`${pack}: unknown quarantine class '${entry.class}'`)
  }
}

const quarantine = loadPackQuarantine()
const manifest = new Map(loadFullManifest().map((e) => [e.pack, e]))
const entries = Object.entries(quarantine)

say('='.repeat(72))
say(`quarantined packs: ${entries.length} of ${manifest.size}`)
say('='.repeat(72))

const stale: string[] = []
const unknown: string[] = []

for (const [pack, entry] of entries) {
  const row = manifest.get(pack)
  if (!row) {
    unknown.push(pack)
    say(`  ${pack}: NOT IN MANIFEST - the quarantine outlived the pack`)
    continue
  }
  const ref = packIdentity(row)
  const broken = await stillBroken(pack, entry, ref)
  say(`  ${pack}  [${entry.class}]  ${broken ? 'still broken' : 'FIXED'}`)
  say(`     ${entry.reason}`)
  say(`     upstream fix: ${entry.upstreamFix}`)
  if (!broken) stale.push(pack)
}

say('')
const problems: string[] = []
if (stale.length)
  problems.push(
    `${stale.join(', ')} now install cleanly - remove them from packQuarantine.json and let them back into the population`
  )
if (unknown.length)
  problems.push(
    `${unknown.join(', ')} are quarantined but not in the manifest - drop the entries`
  )
if (entries.length > MAX_QUARANTINED_PACKS)
  problems.push(
    `${entries.length} packs quarantined, limit is ${MAX_QUARANTINED_PACKS} - the suite is measuring materially less than it claims`
  )

for (const problem of problems) process.stdout.write(`::error::${problem}\n`)
process.exitCode = problems.length ? 1 : 0
