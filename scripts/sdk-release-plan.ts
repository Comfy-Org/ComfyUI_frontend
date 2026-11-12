import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gt, inc } from 'semver'

/**
 * Which SDK packages need a release, decided against each package's last
 * released version: the commit that set the newest version of it on npm, so a
 * bump that merged but never published is planned again.
 *
 * - `ingest-types` releases only when a schema an SDK package imports, or one
 *   such a schema is built from, changed. Endpoints no SDK package reads do
 *   not ship a release.
 * - The hand-written SDK packages release when their published source or any
 *   published manifest field changed.
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
/** A string or regex literal, kept verbatim, or a whitespace run outside one. */
const LITERAL_OR_SPACE =
  /('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`|\/(?![*/])(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[a-z]*)|\s+/g
const TEST_FILE = /(\.test\.ts|\.spec\.ts|\/__fixtures__\/|\/__mocks__\/)/
const WORKSPACE = 'pnpm-workspace.yaml'
const CATALOG_ENTRY = /^[ \t]+['"]?([^'":\s]+)['"]?:[ \t]*['"]?([^'"#\s]+)/gm
const CATALOG_RESOLVED_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies'
]
const UNPUBLISHED_MANIFEST_FIELDS = new Set([
  'version',
  'scripts',
  'devDependencies'
])

type Package = (typeof SDK_PACKAGES)[number] | 'ingest-types'

export interface ReleaseReason {
  package: Package
  version: string
  reasons: string[]
}

interface PlanOptions {
  root?: string
  publishedVersions?: (name: Package) => ReadonlySet<string>
  /** The open release PR's branch, whose versions a reviewer may have raised. */
  releaseRef?: string
}

/** The next version of a package, keeping a higher one the open release PR already carries. */
export function releaseVersion(
  name: Package,
  current: string,
  open?: string
): string {
  // ADR-RELEASES-PACKAGES-0033 holds the hand-written packages on 1.0.0-alpha.N.
  const next =
    name === 'ingest-types'
      ? inc(current, 'patch')
      : inc(current, 'prerelease', 'alpha')
  if (!next) throw new Error(`Cannot bump ${name}@${current}`)
  return open && gt(open, next) ? open : next
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

/** Each exported schema's definition, with doc comments dropped and spacing outside literals collapsed. */
export function schemaDefinitions(zodGen: string): Map<string, string> {
  const starts = [...zodGen.matchAll(SCHEMA_START)]
  return new Map(
    starts.map((match, index) => {
      const end = starts[index + 1]?.index ?? zodGen.length
      const body = zodGen
        .slice(match.index, end)
        .replace(/\/\*\*[\s\S]*?\*\//g, '')
        .replace(LITERAL_OR_SPACE, (_space, literal?: string) => literal ?? ' ')
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

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' })
}

function read(root: string, file: string): string {
  return readFileSync(join(root, file), 'utf8')
}

function npmVersions(name: Package): Set<string> {
  const json = execFileSync(
    'npm',
    ['view', `@comfyorg/${name}`, 'versions', '--json'],
    { encoding: 'utf8' }
  )
  return new Set([JSON.parse(json)].flat())
}

function versionCommit(
  root: string,
  manifest: string,
  version: string,
  from: string
): string {
  const commit = git(
    root,
    'log',
    '-1',
    '--format=%H',
    `-S"version": "${version}"`,
    from,
    '--',
    manifest
  ).trim()
  if (!commit) throw new Error(`No commit set ${manifest} to ${version}`)
  return commit
}

/** The commit that set the newest version npm has; a bump whose publish failed is not a release. */
function releasedCommit(
  root: string,
  name: Package,
  published: ReadonlySet<string>
): string {
  const manifest = `packages/${name}/package.json`
  let version = JSON.parse(read(root, manifest)).version as string
  let commit = versionCommit(root, manifest, version, 'HEAD')
  while (!published.has(version)) {
    let previous: string
    try {
      previous = git(root, 'show', `${commit}^:${manifest}`)
    } catch {
      throw new Error(`No version of ${name} in git history is on npm`)
    }
    version = JSON.parse(previous).version as string
    commit = versionCommit(root, manifest, version, `${commit}^`)
  }
  return commit
}

function changedSourceFiles(
  root: string,
  name: Package,
  since: string
): string[] {
  return git(
    root,
    'diff',
    '--name-only',
    since,
    'HEAD',
    '--',
    `packages/${name}/src`
  )
    .split('\n')
    .filter((file) => file && !TEST_FILE.test(file))
}

/** The default `catalog:` block of a `pnpm-workspace.yaml`, as package name to range. */
export function catalogRanges(workspaceYaml: string): Map<string, string> {
  const block = /^catalog:\n((?:[ \t]+.*\n?)*)/m.exec(workspaceYaml)?.[1] ?? ''
  return new Map(
    [...block.matchAll(CATALOG_ENTRY)].map(([, name, range]) => [name, range])
  )
}

function withCatalogResolved(
  manifest: Record<string, unknown>,
  catalog: Map<string, string>
): Record<string, unknown> {
  const resolved = { ...manifest }
  for (const field of CATALOG_RESOLVED_FIELDS) {
    const ranges = manifest[field]
    if (!ranges || typeof ranges !== 'object') continue
    resolved[field] = Object.fromEntries(
      Object.entries(ranges).map(([name, range]) => [
        name,
        range === 'catalog:' ? (catalog.get(name) ?? range) : range
      ])
    )
  }
  return resolved
}

/** The top-level `package.json` fields that ship to npm and differ between the two manifests, `catalog:` ranges resolved. */
export function changedManifestFields(
  released: string,
  current: string,
  releasedWorkspace = '',
  currentWorkspace = ''
): string[] {
  const before = withCatalogResolved(
    JSON.parse(released),
    catalogRanges(releasedWorkspace)
  )
  const after = withCatalogResolved(
    JSON.parse(current),
    catalogRanges(currentWorkspace)
  )
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(
      (field) =>
        !UNPUBLISHED_MANIFEST_FIELDS.has(field) &&
        JSON.stringify(before[field]) !== JSON.stringify(after[field])
    )
    .sort()
}

function sdkSources(root: string): string[] {
  return SDK_PACKAGES.flatMap((name) =>
    git(root, 'ls-files', `packages/${name}/src`)
      .split('\n')
      .filter((file) => file.endsWith('.ts') && !TEST_FILE.test(file))
      .map((file) => read(root, file))
  )
}

/** Whether HEAD only bumps package versions, as merging a release does. */
function isReleaseMerge(root: string): boolean {
  const manifests = new Set(
    (['ingest-types', ...SDK_PACKAGES] as const).map(
      (name) => `packages/${name}/package.json`
    )
  )
  const withoutVersion = (ref: string, file: string) => {
    const { version: _, ...rest } = JSON.parse(
      git(root, 'show', `${ref}:${file}`)
    )
    return JSON.stringify(rest)
  }
  try {
    const files = git(root, 'diff', '--name-only', 'HEAD^', 'HEAD')
      .split('\n')
      .filter(Boolean)
    return (
      files.length > 0 &&
      files.every(
        (file) =>
          manifests.has(file) &&
          withoutVersion('HEAD^', file) === withoutVersion('HEAD', file)
      )
    )
  } catch {
    return false
  }
}

export function planRelease({
  root = process.cwd(),
  publishedVersions = npmVersions,
  releaseRef
}: PlanOptions = {}): ReleaseReason[] {
  // Its publish is still running, so npm lacking the version is not a failure
  // yet. A failed publish is planned again on the next push.
  if (isReleaseMerge(root)) return []
  const plan: ReleaseReason[] = []
  const released = (name: Package) =>
    releasedCommit(root, name, publishedVersions(name))
  const release = (name: Package, reasons: string[]) => {
    const manifest = `packages/${name}/package.json`
    const open = releaseRef
      ? git(root, 'show', `${releaseRef}:${manifest}`)
      : undefined
    plan.push({
      package: name,
      version: releaseVersion(
        name,
        JSON.parse(read(root, manifest)).version,
        open && JSON.parse(open).version
      ),
      reasons
    })
  }

  const ingestReleased = released('ingest-types')
  const schemas = changedSchemas(
    git(root, 'show', `${ingestReleased}:${INGEST_ZOD}`),
    read(root, INGEST_ZOD),
    referencedSchemas(sdkSources(root))
  )
  if (schemas.length > 0) release('ingest-types', schemas)

  for (const name of SDK_PACKAGES) {
    const since = released(name)
    const manifest = `packages/${name}/package.json`
    const reasons = [
      ...changedSourceFiles(root, name, since),
      ...changedManifestFields(
        git(root, 'show', `${since}:${manifest}`),
        read(root, manifest),
        git(root, 'show', `${since}:${WORKSPACE}`),
        read(root, WORKSPACE)
      ).map((field) => `${manifest}#${field}`)
    ]
    if (reasons.length > 0) release(name, reasons)
  }
  return plan
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const plan = planRelease({
    releaseRef: process.env.SDK_RELEASE_REF || undefined
  })
  const summary = JSON.stringify(plan)
  console.log(summary)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `plan=${summary}\n`)
  }
}
