/**
 * Reports every excluded pack and rechecks externally verifiable failures.
 *
 * Quarantine removes a pack from the population, so it is lost coverage that
 * looks like a green run. The only thing that makes it safe is this: each
 * source failure is rechecked against the live world, and a fixed entry fails.
 * Hardware exclusions cannot be rechecked on this CPU runner; they stay bold
 * in the Actions summary with the GPU-shard work needed to restore coverage.
 *
 *   pnpm custom-node-quarantine
 */
import { execFile } from 'node:child_process'
import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import type { QuarantinedPack } from '../browser_tests/fixtures/customNode/manifest'
import { CLOUD_RUN_EXCLUSIONS } from '../browser_tests/fixtures/customNode/autoRun'
import { FRONTEND_ASSET_EXCLUSIONS,
  loadFullManifest,
  loadPackQuarantine,
  packIdentity,
  staleLocalExpectations } from '../browser_tests/fixtures/customNode/manifest'
import { startupErrorExclusionsForPacks } from '../browser_tests/fixtures/customNode/consoleErrorLedger'
import { ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH } from '../browser_tests/fixtures/customNode/valueDrift'

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
    case 'requires-gpu-runner':
      return true
    default:
      throw new Error(`${pack}: unknown quarantine class '${entry.class}'`)
  }
}

const quarantine = loadPackQuarantine()
const manifest = new Map(loadFullManifest().map((e) => [e.pack, e]))
const manifestPackByFoldedName = new Map(
  [...manifest.keys()].map((pack) => [pack.toLowerCase(), pack])
)
const entries = Object.entries(quarantine)

const summary: string[] = []
const note = (line: string) => {
  say(line)
  summary.push(line)
}

note(`## Excluded packs - **${entries.length} of ${manifest.size}**`)
note('')
note('Every entry below is coverage this run did NOT measure.')
note('')

const stale: string[] = []
const unknown: string[] = []

for (const [pack, entry] of entries) {
  const row = manifest.get(pack)
  if (!row) {
    unknown.push(pack)
    note(`- **${pack}** - NOT IN MANIFEST, the exclusion outlived the pack`)
    continue
  }
  const ref = packIdentity(row)
  const broken = await stillBroken(pack, entry, ref)
  const status =
    entry.class === 'requires-gpu-runner'
      ? 'requires GPU-backed coverage'
      : broken
        ? 'still excluded'
        : '**FIXED UPSTREAM**'
  note(`- **${pack}** \`${entry.class}\` - ${status}`)
  note(`  - ${entry.reason}`)
  note(`  - to remove: ${entry.upstreamFix}`)
  process.stdout.write(
    `::warning title=Pack excluded from the suite::${pack} - ${entry.reason}\n`
  )
  if (entry.class !== 'requires-gpu-runner' && !broken) stale.push(pack)
}

const nodeExclusions = [
  ...Object.entries(ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH).flatMap(
    ([pack, nodes]) =>
      Object.entries(nodes).map(([nodeType, exclusion]) => ({
        label: `${nodeType} save/reload`,
        pack,
        ...exclusion
      }))
  ),
  ...Object.entries(FRONTEND_ASSET_EXCLUSIONS).map(([pack, exclusion]) => ({
    label: `${pack} frontend assets`,
    pack,
    reason: exclusion.reason,
    restore: exclusion.restore
  })),
  ...startupErrorExclusionsForPacks([...manifest.keys()]),
  ...Object.entries(CLOUD_RUN_EXCLUSIONS).flatMap(([ledgerPack, nodes]) => {
    const pack = manifestPackByFoldedName.get(ledgerPack.toLowerCase())
    return pack
      ? Object.entries(nodes).map(([node, exclusion]) => ({
          label: `${pack} / ${node} execution`,
          pack,
          ...exclusion
        }))
      : []
  })
]
const unknownNodeExclusions: string[] = []
note('')
note(`## Temporary node-check exclusions - **${nodeExclusions.length}**`)
note('')
note('Every entry below is coverage this run did NOT measure.')
note('')
for (const exclusion of nodeExclusions) {
  note(`- **${exclusion.label} - SKIP**`)
  note(`  - ${exclusion.reason}`)
  note(`  - to remove: ${exclusion.restore}`)
  process.stdout.write(
    `::warning title=Custom-node check excluded::${exclusion.label} - ${exclusion.reason}\n`
  )
  if (!manifest.has(exclusion.pack)) unknownNodeExclusions.push(exclusion.label)
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
if (unknownNodeExclusions.length)
  problems.push(
    `${unknownNodeExclusions.join(', ')} exclude node checks for packs outside the manifest`
  )
const staleBaselines = staleLocalExpectations()
if (staleBaselines.length)
  problems.push(
    `${staleBaselines.join(', ')} now register the count the manifest expects - drop them from localExpectations.json`
  )
for (const problem of problems) {
  note(`- **PROBLEM** ${problem}`)
  process.stdout.write(`::error::${problem}\n`)
}

const stepSummary = process.env.GITHUB_STEP_SUMMARY
if (stepSummary) appendFileSync(stepSummary, `${summary.join('\n')}\n`)
process.exitCode = problems.length ? 1 : 0
