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
import { connectivityExpectations } from '../browser_tests/fixtures/customNode/connectivityExpectations'
import {
  customNodesManifest,
  FRONTEND_ASSET_EXCLUSIONS,
  loadAllManifestTargets,
  loadFullManifest,
  loadPackQuarantine,
  loadUnjoinedYamlPacks,
  packIdentity,
  staleLocalExpectations
} from '../browser_tests/fixtures/customNode/manifest'
import { consoleErrorExclusionsForPacks } from '../browser_tests/fixtures/customNode/consoleErrorLedger'
import {
  CUSTOM_NODE_TIER_NODE_EXCLUSIONS,
  tierNodeExclusionProblems
} from '../browser_tests/fixtures/customNode/tierNodeExclusions'
import { ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH } from '../browser_tests/fixtures/customNode/valueDrift'
import {
  provesRefIsMissing,
  provesRequirementIsUnsatisfiable
} from './customNodeQuarantineProbe'

const run = promisify(execFile)

const say = (line: string) => process.stdout.write(`${line}\n`)

async function dryRunPython(): Promise<string> {
  const candidates = [
    process.env.CUSTOM_NODE_PYTHON,
    'python3',
    'python3.13',
    'python3.12',
    'python3.11',
    'python'
  ].filter((candidate): candidate is string => candidate !== undefined)
  for (const candidate of new Set(candidates)) {
    try {
      const { stdout } = await run(
        candidate,
        ['-m', 'pip', 'install', '--help'],
        { timeout: 30_000 }
      )
      if (stdout.includes('--dry-run')) return candidate
    } catch {
      continue
    }
  }
  throw new Error('no Python interpreter provides pip install --dry-run')
}

async function refStillMissing(deployRef: string): Promise<boolean> {
  const [url, sha] = deployRef.split(/@(?=[^@]*$)/)
  if (!url || !sha) throw new Error(`invalid git deployRef: ${deployRef}`)
  const dir = mkdtempSync(join(tmpdir(), 'cnq-'))
  await run('git', ['init', '-q', dir], { timeout: 30_000 })
  await run('git', ['-C', dir, 'remote', 'add', 'origin', url])
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await run('git', ['-C', dir, 'fetch', '--depth', '1', 'origin', sha], {
        timeout: 90_000
      })
      return false
    } catch (error) {
      if (provesRefIsMissing(error)) return true
      lastError = error
      if (attempt < 2)
        await new Promise((resolve) =>
          setTimeout(resolve, (attempt + 1) * 1000)
        )
    }
  }
  throw new Error(`could not conclusively recheck ${deployRef}`, {
    cause: lastError
  })
}

async function requirementsStillUnsatisfiable(
  deployRef: string,
  failurePattern: string
): Promise<boolean> {
  const [url, sha] = deployRef.split(/@(?=[^@]*$)/)
  const slug = url?.split('github.com/')[1]
  if (!slug || !sha) throw new Error(`invalid git deployRef: ${deployRef}`)
  let body: string
  try {
    const { stdout } = await run('curl', [
      '-sfL',
      '--retry',
      '3',
      '--retry-delay',
      '1',
      '--retry-connrefused',
      '--max-time',
      '30',
      `https://raw.githubusercontent.com/${slug}/${sha}/requirements.txt`
    ])
    body = stdout
  } catch (error) {
    throw new Error(`could not fetch requirements for ${deployRef}`, {
      cause: error
    })
  }
  const dir = mkdtempSync(join(tmpdir(), 'cnq-'))
  const file = join(dir, 'requirements.txt')
  writeFileSync(file, body)
  const python = await dryRunPython()
  try {
    await run(
      python,
      [
        '-m',
        'pip',
        'install',
        '--dry-run',
        '--quiet',
        '--target',
        join(dir, 'target'),
        '-r',
        file
      ],
      { timeout: 300_000 }
    )
    return false
  } catch (error) {
    if (provesRequirementIsUnsatisfiable(error, failurePattern)) return true
    throw new Error(
      `could not conclusively resolve requirements for ${deployRef}`,
      { cause: error }
    )
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
      return requirementsStillUnsatisfiable(deployRef, entry.failurePattern)
    case 'requires-gpu-runner':
      return true
    default:
      throw new Error(`${pack}: unknown quarantine class`)
  }
}

const quarantine = customNodesManifest() === 'cloud' ? loadPackQuarantine() : {}
const manifest = new Map(loadFullManifest().map((e) => [e.pack, e]))
const unjoinedYamlPacks = loadUnjoinedYamlPacks()
const manifestPackByFoldedName = new Map(
  [...manifest.keys()].map((pack) => [pack.toLowerCase(), pack])
)
const entries = Object.entries(quarantine)
const connectivityExclusions = [
  ...connectivityExpectations.connectRejected,
  ...connectivityExpectations.deterministicSlotContractMismatch,
  ...connectivityExpectations.dynamicSlotCleanupStalled,
  ...connectivityExpectations.roundtripLost
].flatMap((group) => {
  const pack = manifestPackByFoldedName.get(group.pack.toLowerCase())
  return pack
    ? [
        {
          label: `${pack} connectivity ${group.id} (${group.pairs.length} pair${group.pairs.length === 1 ? '' : 's'})`,
          pack,
          reason: group.reason,
          restore: group.restore,
          scope: 'connectivity breadth sweep',
          tier: 'S4' as const,
          mode: 'expected-failure' as const
        }
      ]
    : []
})

const summary: string[] = []
const note = (line: string) => {
  say(line)
  summary.push(line)
}

note(
  `## Pack-level coverage exclusions - **${entries.length + unjoinedYamlPacks.length} of ${manifest.size + unjoinedYamlPacks.length} packs**`
)
note('')
note(
  'These are whole-pack skips: the pack was not installed, so **no S-tier ran** for it.'
)
note('')

const stale: string[] = []
const unknown: string[] = []
const inconclusive: string[] = []

for (const pack of unjoinedYamlPacks) {
  note(`- **PACK - SKIP - NO S-TIER RAN - ${pack}** \`unjoined-object-info\``)
  note('  - meaning: no test surface exercised this pack')
  note(
    '  - the pinned Cloud YAML names the pack, but its object_info snapshot has no nodes attributable to it'
  )
  note(
    '  - to remove: fix the pack attribution or registration, then regenerate the cloud manifest'
  )
  process.stdout.write(
    `::warning title=Pack excluded from the suite::${pack} - no nodes joined from the pinned object_info snapshot\n`
  )
}

for (const [pack, entry] of entries) {
  const row = manifest.get(pack)
  if (!row) {
    unknown.push(pack)
    note(`- **${pack}** - NOT IN MANIFEST, the exclusion outlived the pack`)
    continue
  }
  const ref = packIdentity(row)
  let broken: boolean
  try {
    broken = await stillBroken(pack, entry, ref)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    inconclusive.push(`${pack}: ${detail}`)
    note(
      `- **PACK - SKIP - NO S-TIER RAN - ${pack} - PROBE INCONCLUSIVE** \`${entry.class}\``
    )
    note('  - meaning: no test surface exercised this pack')
    note(`  - ${entry.reason}`)
    note(`  - gate failure: ${detail}`)
    process.stdout.write(
      `::error title=Pack exclusion probe inconclusive::${pack} - ${detail}\n`
    )
    continue
  }
  const status =
    entry.class === 'requires-gpu-runner'
      ? 'requires GPU-backed coverage'
      : broken
        ? 'still excluded'
        : '**FIXED UPSTREAM**'
  note(
    `- **PACK - SKIP - NO S-TIER RAN - ${pack}** \`${entry.class}\` - ${status}`
  )
  note('  - meaning: no test surface exercised this pack')
  note(`  - ${entry.reason}`)
  note(`  - to remove: ${entry.upstreamFix}`)
  process.stdout.write(
    `::warning title=Pack excluded from the suite::${pack} - ${entry.reason}\n`
  )
  if (entry.class !== 'requires-gpu-runner' && !broken) stale.push(pack)
}

const tierNodeProblems = tierNodeExclusionProblems(loadAllManifestTargets())
const currentManifestTargets = [...manifest.values()].map((entry) => ({
  identity: packIdentity(entry),
  pack: entry.pack
}))
const applicableTierNodeExclusions = CUSTOM_NODE_TIER_NODE_EXCLUSIONS.filter(
  (exclusion) =>
    currentManifestTargets.some(
      (target) =>
        target.pack.toLowerCase() === exclusion.pack.toLowerCase() &&
        target.identity === exclusion.identity
    )
)
const excludedTierSurfaces = applicableTierNodeExclusions.reduce(
  (total, exclusion) => total + exclusion.tiers.length,
  0
)
note('')
note(
  `## Tier-scoped node coverage exclusions - **${applicableTierNodeExclusions.length} node, ${excludedTierSurfaces} S-tier surfaces**`
)
note('')
note(
  'The pack still has an exact registration-count sentinel and its other nodes run. Only the named node is excluded from the named tiers.'
)
note('')
for (const exclusion of applicableTierNodeExclusions) {
  note(
    `- **${exclusion.tiers.join('/')} - SKIP - NODE NOT EXERCISED - ${exclusion.pack} / ${exclusion.nodeType}**`
  )
  note(`  - pinned artifact: ${exclusion.identity}`)
  note(`  - reason: ${exclusion.reason}`)
  note(`  - to remove: ${exclusion.restore}`)
  note(`  - ticket: ${exclusion.ticket}`)
  process.stdout.write(
    `::warning title=${exclusion.tiers.join('/')} node coverage skipped::${exclusion.pack} / ${exclusion.nodeType} - ${exclusion.reason}\n`
  )
}

const nodeExclusions = [
  ...Object.entries(ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH)
    .filter(([pack]) => manifest.has(pack))
    .flatMap(([pack, nodes]) =>
      Object.entries(nodes).map(([nodeType, exclusion]) => ({
        label: `${nodeType} save/reload`,
        pack,
        ...exclusion,
        scope: 'save/reload sweep',
        tier: 'S3' as const,
        mode: 'expected-failure' as const
      }))
    ),
  ...Object.entries(FRONTEND_ASSET_EXCLUSIONS)
    .filter(([pack]) => manifest.has(pack))
    .map(([pack, exclusion]) => ({
      label: `${pack} frontend assets`,
      pack,
      reason: exclusion.reason,
      restore: exclusion.restore,
      scope: 'frontend asset registration',
      tier: 'S11' as const,
      mode: 'expected-failure' as const
    })),
  ...consoleErrorExclusionsForPacks([...manifest.keys()]),
  ...connectivityExclusions
].sort(
  (left, right) =>
    left.tier.localeCompare(right.tier, undefined, { numeric: true }) ||
    left.label.localeCompare(right.label)
)
const unknownNodeExclusions: string[] = []
const exactDefects = nodeExclusions.filter(
  (exclusion) => exclusion.mode === 'expected-failure'
).length
const conditionalAllowances = nodeExclusions.length - exactDefects
note('')
note(
  `## Tier-scoped acceptance ledger - **${exactDefects} exact defects, ${conditionalAllowances} conditional allowances**`
)
note('')
note(
  'These are assertion exceptions, not skipped tests. The named S-tier still ran. An exact defect must reproduce its recorded outcome; a conditional S8 allowance accepts only the named error signature if environmental state triggers it.'
)
note('')
for (const exclusion of nodeExclusions) {
  const status =
    exclusion.mode === 'conditional-console'
      ? 'CONDITIONAL ERROR ALLOWANCE - TEST RAN'
      : 'EXACT KNOWN DEFECT - TEST RAN'
  note(`- **${exclusion.tier} - ${status} - ${exclusion.label}**`)
  note(`  - exercised in: ${exclusion.scope}`)
  note(`  - ${exclusion.reason}`)
  note(`  - to remove: ${exclusion.restore}`)
  process.stdout.write(
    `::warning title=${exclusion.tier} accepted defect::${exclusion.label} - ${exclusion.reason}\n`
  )
  if (!manifest.has(exclusion.pack)) unknownNodeExclusions.push(exclusion.label)
}

say('')
const problems: string[] = [...inconclusive, ...tierNodeProblems]
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
