/**
 * Reports and bumps the commit each manifest pack is pinned at.
 *
 * The suite installs custom-node packs at fixed commits so no git surface
 * moves underneath a PR. That is the right call - unpinned, every pack author
 * becomes a committer to this repo's CI, and a bug pushed to any of them reds
 * the next unrelated PR. The cost is the mirror image: pack breakage is
 * invisible until someone bumps, and nothing was telling anyone when to.
 *
 *   pnpm custom-node-pins           report age and whether upstream moved
 *   pnpm custom-node-pins:update    rewrite the pins to upstream HEAD
 *
 * A bump is expected to red the suite. `expectedNodeCount` and
 * `expectedExtensions` are calibrated against the pinned source, and the
 * manifest is explicit that any delta fails until it is deliberately
 * recalibrated. That failure is the suite telling you what changed in the
 * ecosystem, which is the whole reason to bump on purpose rather than drift.
 */
import { execFile } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)

// Lazy: import.meta.url is not a file: URL under vitest, so resolving this at
// module scope makes the file unimportable by its own test.
function manifestPath(): string {
  return fileURLToPath(
    new URL(
      '../browser_tests/fixtures/data/customNodeManifest.core.json',
      import.meta.url
    )
  )
}

export const MAX_AGE_DAYS = 30
const UPDATE_WORKFLOW =
  'https://github.com/Comfy-Org/ComfyUI_frontend/actions/workflows/update-custom-node-pins.yaml'

interface PinnedPack {
  pack: string
  repo: string
  pin: string
  pinnedAt?: string
}

/** Whole days elapsed, or null when the pin carries no usable date. */
export function ageInDays(
  pinnedAt: string | undefined,
  today: Date
): number | null {
  if (!pinnedAt) return null
  const then = Date.parse(`${pinnedAt}T00:00:00Z`)
  if (Number.isNaN(then)) return null
  // Date.parse rolls 2026-02-31 forward to March 3 rather than rejecting it,
  // which would report an age three days short instead of no age at all.
  if (new Date(then).toISOString().slice(0, 10) !== pinnedAt) return null
  return Math.floor((today.getTime() - then) / 86_400_000)
}

/** The oldest pin is what the suite's freshness is actually worth. */
export function stalest(packs: PinnedPack[], today: Date): number | null {
  const ages = packs.map((p) => ageInDays(p.pinnedAt, today))
  if (ages.some((a) => a === null)) return null
  return Math.max(...(ages as number[]))
}

async function headSha(repo: string): Promise<string> {
  try {
    const { stdout } = await run('git', ['ls-remote', repo, 'HEAD'], {
      timeout: 60_000
    })
    return stdout.split(/\s/)[0] ?? ''
  } catch {
    return ''
  }
}

function load(): PinnedPack[] {
  return JSON.parse(readFileSync(manifestPath(), 'utf8')) as PinnedPack[]
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function say(line: string): void {
  process.stdout.write(`${line}\n`)
}

async function report(): Promise<number> {
  const packs = load()
  const now = new Date()
  const heads = await Promise.all(packs.map((p) => headSha(p.repo)))

  say('='.repeat(72))
  const age = stalest(packs, now)
  say(
    age === null
      ? 'CUSTOM-NODE PINS: no pin dates recorded - freshness unknown'
      : `custom-node pins: oldest is ${age} day(s) old (limit ${MAX_AGE_DAYS})`
  )
  say(`  update via   ${UPDATE_WORKFLOW}`)
  say('  or locally   pnpm custom-node-pins:update')
  say('='.repeat(72))

  for (const [i, p] of packs.entries()) {
    const days = ageInDays(p.pinnedAt, now)
    const moved = heads[i] && heads[i] !== p.pin
    say(
      `  ${p.pack.padEnd(28)} ${p.pin.slice(0, 10)}` +
        `  ${p.pinnedAt ?? 'undated'}` +
        `${days === null ? '' : ` (${days}d)`}` +
        `  ${!heads[i] ? 'upstream unreachable' : moved ? 'UPSTREAM MOVED' : 'at upstream HEAD'}`
    )
  }

  if (age !== null && age <= MAX_AGE_DAYS) return 0
  const summary =
    age === null
      ? `custom-node pins carry no date - bump them at ${UPDATE_WORKFLOW}`
      : `custom-node pins are ${age} days old - bump them at ${UPDATE_WORKFLOW}`
  say(`::warning title=Custom-node pins are stale::${summary}`)
  return 0
}

async function update(): Promise<number> {
  const packs = load()
  const stamp = today()
  const heads = await Promise.all(packs.map((p) => headSha(p.repo)))

  const unreachable = packs.filter((_, i) => !heads[i]).map((p) => p.pack)
  if (unreachable.length) {
    process.stderr.write(`could not resolve: ${unreachable.join(', ')}\n`)
    return 1
  }

  const moved = packs.filter((p, i) => heads[i] !== p.pin)
  const next = packs.map((p, i) => ({
    ...p,
    pin: heads[i],
    pinnedAt: heads[i] === p.pin ? (p.pinnedAt ?? stamp) : stamp
  }))
  writeFileSync(manifestPath(), `${JSON.stringify(next, null, 2)}\n`)

  for (const p of moved) {
    const to = heads[packs.indexOf(p)]
    say(`  ${p.pack.padEnd(28)} ${p.pin.slice(0, 10)} -> ${to.slice(0, 10)}`)
  }
  say(
    `${moved.length} of ${packs.length} pins moved; recalibrate` +
      ' expectedNodeCount / expectedExtensions if the suite reds'
  )
  return 0
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href

if (invokedDirectly) {
  process.exitCode = await (process.argv.includes('--write')
    ? update()
    : report())
}
