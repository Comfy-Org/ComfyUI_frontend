/**
 * The single definition of "publishable" for the three dist-shipping tarballs:
 * `@comfyorg/account-core`, `@comfyorg/billing-contract` and
 * `@comfyorg/ingest-types`. `@comfyorg/design-system` publishes `src/css`,
 * `src/icons` and `src/workspaceAvatar.ts` on purpose, which these dist-only
 * rules would reject, so it keeps its own allowlist in
 * `.github/workflows/ci-design-system-pack.yaml`.
 * Pure: callers hand over the packed file list and the packed manifest, so both
 * the pack smoke test and the per-package CI check enforce the same rules
 * instead of each re-deriving them.
 */
import { z } from 'zod'

const zSpecifiers = z.record(z.string(), z.string())

export const zPublishedManifest = z.object({
  name: z.string(),
  version: z.string(),
  exports: z.record(z.string(), z.unknown()),
  dependencies: zSpecifiers.optional(),
  peerDependencies: zSpecifiers.optional(),
  optionalDependencies: zSpecifiers.optional()
})

export type PublishedManifest = z.infer<typeof zPublishedManifest>

export interface PackedPackage {
  /** Tarball entries with the leading `package/` stripped. */
  files: string[]
  manifest: PublishedManifest
}

export interface PublishableViolation {
  title: string
  message: string
  details: string[]
}

const PACKED_ROOT_FILES = new Set(['package.json', 'LICENSE', 'README.md'])
const DIST_DIR = 'dist/'
const DIST_TARGET = './dist/'
const MANIFEST_TARGET = './package.json'
const NON_PUBLIC_FILE =
  /(\.test\.(?:d\.)?[cm]?[jt]s$|(^|\/)__fixtures__\/|^src\/)/
const WORKSPACE_ONLY_SPECIFIER = /^(catalog|workspace):/
const REGEXP_SPECIAL = /[.+^${}()|[\]\\]/g
const DEPENDENCY_GROUPS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies'
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function exportTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (value === null) return []
  if (isRecord(value)) return Object.values(value).flatMap(exportTargets)
  throw new Error(
    `Malformed export target: expected a string, an object, or null, got ${typeof value} ${JSON.stringify(value)}`
  )
}

/** Pattern exports such as `./dist/vue/*` match many packed files. */
function packedFileMatcher(target: string): RegExp {
  const source = target
    .replace(/^\.\//, '')
    .replace(REGEXP_SPECIAL, '\\$&')
    .replace(/[*?]/g, (wildcard) => (wildcard === '*' ? '.*' : '.'))
  return new RegExp(`^${source}$`)
}

export function findPublishableViolations({
  files,
  manifest
}: PackedPackage): PublishableViolation[] {
  const violations: PublishableViolation[] = []

  const unexpected = files.filter(
    (path) => !PACKED_ROOT_FILES.has(path) && !path.startsWith(DIST_DIR)
  )
  if (unexpected.length > 0) {
    violations.push({
      title: 'Unexpected files in tarball',
      message: 'Packed tarball contains files outside dist:',
      details: unexpected
    })
  }

  const nonPublic = files.filter((path) => NON_PUBLIC_FILE.test(path))
  if (nonPublic.length > 0) {
    violations.push({
      title: 'Source files in tarball',
      message: 'Packed tarball contains source, test, or fixture files:',
      details: nonPublic
    })
  }

  const targets = [...new Set(exportTargets(manifest.exports))]

  const escapingDist = targets.filter(
    (target) => target !== MANIFEST_TARGET && !target.startsWith(DIST_TARGET)
  )
  if (escapingDist.length > 0) {
    violations.push({
      title: 'Exports escape dist',
      message: 'Published exports must resolve to compiled dist output:',
      details: escapingDist
    })
  }

  const missing = targets.filter((target) => {
    const matcher = packedFileMatcher(target)
    return !files.some((path) => matcher.test(path))
  })
  if (missing.length > 0) {
    violations.push({
      title: 'Exports missing from tarball',
      message: 'Published exports point at files the tarball does not contain:',
      details: missing
    })
  }

  const unrewritten = DEPENDENCY_GROUPS.flatMap((group) =>
    Object.entries(manifest[group] ?? {})
      .filter(([, specifier]) => WORKSPACE_ONLY_SPECIFIER.test(specifier))
      .map(([name, specifier]) => `${group}.${name}: ${specifier}`)
  )
  if (unrewritten.length > 0) {
    violations.push({
      title: 'Unresolved workspace specifiers',
      message:
        'Published manifest must not contain catalog:/workspace: ranges:',
      details: unrewritten
    })
  }

  return violations
}

export function formatViolations(
  violations: PublishableViolation[],
  { annotate = false }: { annotate?: boolean } = {}
): string {
  return violations
    .map(({ title, message, details }) =>
      [
        annotate ? `::error title=${title}::${message}` : message,
        ...details
      ].join('\n')
    )
    .join('\n')
}
