/**
 * Runs a pack twice — as shipped and as converted — and reports the difference.
 *
 * This is the check the conformance battery could not make. Everything it does
 * is comparative: a pack that already fails to load, or a node type that never
 * constructed, is not the conversion's fault, so only a *change* is reported.
 *
 * Each image runs in its own process. The litegraph type registry, the module
 * cache and the Pinia instance are all global, so a second load in the same
 * process would see the first image's state and report success it did not earn.
 */
import { execFile } from 'node:child_process'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

import { candidateCategory, candidateTypes } from './candidates.mjs'

const run = promisify(execFile)
const RUN_IMAGE = new URL('./runImage.mjs', import.meta.url).pathname
const REPO = new URL('../../..', import.meta.url).pathname

/** Builds one image: the pack as-is, with `drafts` overlaid. */
function buildImage(source, destination, drafts) {
  cpSync(source, destination, { recursive: true })
  // Without this Node treats the pack's `.js` as CommonJS, its imports become
  // `require`, and the loader hook that supplies the host modules never runs.
  writeFileSync(join(destination, 'package.json'), '{"type":"module"}\n')
  for (const [relative, converted] of Object.entries(drafts)) {
    const target = join(destination, relative)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, converted)
  }
  return destination
}

async function observe(spec, workspace, label) {
  const specPath = join(workspace, `${label}.json`)
  writeFileSync(specPath, JSON.stringify(spec))
  try {
    const { stdout } = await run(
      'node_modules/.bin/tsx',
      [RUN_IMAGE, specPath],
      { cwd: REPO, timeout: 120_000, maxBuffer: 32 * 1024 * 1024 }
    )
    // The harness prints JSON on the last line; packs are free to log above it.
    const line = stdout.trim().split('\n').at(-1)
    return JSON.parse(line)
  } catch (error) {
    return {
      loaded: false,
      loadErrors: [`image did not run: ${error?.message ?? error}`],
      driveErrors: [],
      registered: [],
      constructed: {},
      wire: {}
    }
  }
}

/**
 * @param packRoot  directory holding the pack as shipped
 * @param entries   pack-relative JS files to import
 * @param drafts    pack-relative path -> converted source
 */
export async function verifyPack({ pack, packRoot, entries, drafts }) {
  const workspace = mkdtempSync(join(tmpdir(), 'magic-patch-verify-'))

  const originals = entries.map((entry) =>
    readFileSync(join(packRoot, entry), 'utf8')
  )
  const converted = entries.map(
    (entry, index) => drafts[entry] ?? originals[index]
  )
  // Derived from both sources: a conversion may name a type the original only
  // reached through a variable, and the two images must be driven identically.
  const types = [
    ...new Set([...candidateTypes(originals), ...candidateTypes(converted)])
  ].sort()
  const category = candidateCategory([...originals, ...converted])

  const spec = (root) => ({ root, entries, types, category })
  const [before, after] = await Promise.all([
    observe(
      spec(buildImage(packRoot, join(workspace, 'before'), {})),
      workspace,
      'before'
    ),
    observe(
      spec(buildImage(packRoot, join(workspace, 'after'), drafts)),
      workspace,
      'after'
    )
  ])

  const problems = []
  if (before.loaded && !after.loaded) {
    problems.push(`pack stopped loading: ${after.loadErrors.join('; ')}`)
  }
  for (const type of before.registered) {
    if (!after.registered.includes(type)) problems.push(`type lost: ${type}`)
  }
  for (const [type, ok] of Object.entries(before.constructed)) {
    if (ok && !after.constructed[type])
      problems.push(`no longer constructs: ${type}`)
  }
  const wireChanged = Object.keys(before.wire)
    .filter((type) => after.wire[type] !== undefined)
    .filter((type) => before.wire[type] !== after.wire[type])

  // Errors the conversion introduced. Ones the original already had are the
  // pack's own, and reporting them would bury the signal.
  const newErrors = after.driveErrors.filter(
    (e) => !before.driveErrors.includes(e)
  )

  return {
    pack,
    types,
    category,
    before,
    after,
    problems,
    wireChanged,
    newErrors,
    // Deliberately not "the conversion is correct" — it is the strongest
    // statement this harness can support: nothing observable got worse.
    regressed:
      problems.length > 0 || wireChanged.length > 0 || newErrors.length > 0
  }
}
