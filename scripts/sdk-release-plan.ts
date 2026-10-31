import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Which SDK packages need a release, decided against each package's last
 * released version (the commit that set the version on main now carries).
 *
 * - `ingest-types` releases only when a schema an SDK package imports, or one
 *   such a schema is built from, changed. Endpoints no SDK package reads do
 *   not ship a release.
 * - The hand-written SDK packages release when their published source changed.
 *
 * `account-core` resolves `ingest-types` as a caret range and keeps it
 * external, so a schema change reaches it through the `ingest-types` release
 * alone; it does not need a release of its own for that.
 */

const SDK_PACKAGES = ['account-core', 'account-ui', 'billing-contract'] as const
const INGEST_ZOD = 'packages/ingest-types/src/zod.gen.ts'
const INGEST_IMPORT =
  /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'@comfyorg\/ingest-types(?:\/zod)?'/g
const SCHEMA_START = /^export const (z[A-Z]\w*) = /gm
const SCHEMA_REFERENCE = /\bz[A-Z]\w*\b/g
const TEST_FILE = /(\.test\.ts|\.spec\.ts|\/__fixtures__\/|\/__mocks__\/)/

type Package = (typeof SDK_PACKAGES)[number] | 'ingest-types'

export interface ReleaseReason {
  package: Package
  reasons: string[]
}

/** The schema names SDK source imports; a type `Foo` stands for its schema `zFoo`. */
export function referencedSchemas(sources: readonly string[]): Set<string> {
  const names = new Set<string>()
  for (const source of sources) {
    for (const [, list] of source.matchAll(INGEST_IMPORT)) {
      for (const raw of list.split(',')) {
        const name = raw
          .replace(/^\s*type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim()
        if (name) names.add(name.startsWith('z') ? name : `z${name}`)
      }
    }
  }
  return names
}

/** Each exported schema's definition, with doc comments and spacing dropped. */
export function schemaDefinitions(zodGen: string): Map<string, string> {
  const starts = [...zodGen.matchAll(SCHEMA_START)]
  return new Map(
    starts.map((match, index) => {
      const end = starts[index + 1]?.index ?? zodGen.length
      const body = zodGen
        .slice(match.index, end)
        .replace(/\/\*\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .trim()
      return [match[1], body]
    })
  )
}

function closure(
  definitions: Map<string, string>,
  roots: Iterable<string>
): Set<string> {
  const seen = new Set<string>()
  const pending = [...roots]
  while (pending.length > 0) {
    const name = pending.pop()!
    if (seen.has(name)) continue
    seen.add(name)
    for (const [reference] of definitions
      .get(name)
      ?.matchAll(SCHEMA_REFERENCE) ?? []) {
      if (reference !== name) pending.push(reference)
    }
  }
  return seen
}

/** The referenced schemas, and what they are built from, whose definition changed. */
export function changedSchemas(
  released: string,
  current: string,
  roots: Iterable<string>
): string[] {
  const before = schemaDefinitions(released)
  const after = schemaDefinitions(current)
  const reachable = new Set([
    ...closure(before, roots),
    ...closure(after, roots)
  ])
  return [...reachable]
    .filter((name) => before.get(name) !== after.get(name))
    .sort()
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' })
}

function releasedCommit(name: Package): string {
  const manifest = `packages/${name}/package.json`
  const version = JSON.parse(readFileSync(manifest, 'utf8')).version as string
  const commit = git(
    'log',
    '-1',
    '--format=%H',
    `-S"version": "${version}"`,
    '--',
    manifest
  ).trim()
  if (!commit) throw new Error(`No commit set ${name}@${version}`)
  return commit
}

function changedSourceFiles(name: Package, since: string): string[] {
  return git('diff', '--name-only', since, 'HEAD', '--', `packages/${name}/src`)
    .split('\n')
    .filter((file) => file && !TEST_FILE.test(file))
}

function dependenciesChanged(name: Package, since: string): boolean {
  const manifest = `packages/${name}/package.json`
  const read = (raw: string) => JSON.stringify(JSON.parse(raw).dependencies)
  return (
    read(git('show', `${since}:${manifest}`)) !==
    read(readFileSync(manifest, 'utf8'))
  )
}

function sdkSources(): string[] {
  return SDK_PACKAGES.flatMap((name) =>
    git('ls-files', `packages/${name}/src`)
      .split('\n')
      .filter((file) => file.endsWith('.ts') && !TEST_FILE.test(file))
      .map((file) => readFileSync(file, 'utf8'))
  )
}

export function planRelease(): ReleaseReason[] {
  const plan: ReleaseReason[] = []

  const ingestReleased = releasedCommit('ingest-types')
  const schemas = changedSchemas(
    git('show', `${ingestReleased}:${INGEST_ZOD}`),
    readFileSync(INGEST_ZOD, 'utf8'),
    referencedSchemas(sdkSources())
  )
  if (schemas.length > 0)
    plan.push({ package: 'ingest-types', reasons: schemas })

  for (const name of SDK_PACKAGES) {
    const released = releasedCommit(name)
    const reasons = changedSourceFiles(name, released)
    if (dependenciesChanged(name, released)) reasons.push('dependencies')
    if (reasons.length > 0) plan.push({ package: name, reasons })
  }
  return plan
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const plan = planRelease()
  const summary = JSON.stringify(plan)
  console.log(summary)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `plan=${summary}\n`)
  }
}
