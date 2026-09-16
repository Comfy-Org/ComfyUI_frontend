/**
 * Packs @comfyorg/account with `pnpm pack`, installs the tarball into a
 * throwaway npm project alongside the declared peers, and imports every
 * export entry from there: the consumer path where an unrewritten
 * `catalog:` specifier or an export target missing from `files` first fails.
 *
 * Workspace siblings are not on npm yet, so they are packed too and pinned
 * through npm `overrides`; drop that once they are published.
 */
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface Manifest {
  readonly name: string
  readonly version: string
  readonly exports: Readonly<Record<string, string>>
  readonly dependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
}

interface PackResult {
  readonly filename: string
  readonly files: ReadonlyArray<{ readonly path: string }>
}

const packageDir = fileURLToPath(new URL('..', import.meta.url))
const workspaceRoot = resolve(packageDir, '..', '..')
const packagesDir = resolve(packageDir, '..')
const keep = process.argv.includes('--keep')

const WORKSPACE_ONLY_SPECIFIER = /^(catalog|workspace):/
const NON_PUBLIC_FILE = /(\.test\.ts$|(^|\/)__fixtures__\/)/

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  })
}

function readManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
}

function workspacePackageDirs(): Map<string, string> {
  return new Map(
    readdirSync(packagesDir)
      .map((entry) => join(packagesDir, entry))
      .filter((dir) => existsSync(join(dir, 'package.json')))
      .map((dir) => [readManifest(dir).name, dir])
  )
}

function workspaceDependencyClosure(
  dir: string,
  dirsByName: Map<string, string>,
  closure = new Map<string, string>()
): Map<string, string> {
  for (const [name, specifier] of Object.entries(
    readManifest(dir).dependencies ?? {}
  )) {
    if (!specifier.startsWith('workspace:') || closure.has(name)) continue
    const depDir = dirsByName.get(name)
    if (!depDir) throw new Error(`workspace dependency ${name} not found`)
    closure.set(name, depDir)
    workspaceDependencyClosure(depDir, dirsByName, closure)
  }
  return closure
}

function pack(dir: string, destination: string): PackResult {
  return JSON.parse(
    run('pnpm', ['pack', '--json', '--pack-destination', destination], dir)
  )
}

function packedManifest(tarball: string): Manifest {
  return JSON.parse(
    run('tar', ['-xzOf', tarball, 'package/package.json'], packageDir)
  )
}

function log(line: string): void {
  process.stdout.write(`${line}\n`)
}

function fail(message: string): never {
  throw new Error(message)
}

function assertPublishable(source: Manifest, packed: PackResult): void {
  const shipped = new Set(packed.files.map((file) => file.path))
  const missingTargets = Object.values(source.exports)
    .map((target) => target.replace(/^\.\//, ''))
    .filter((target) => !shipped.has(target))
  if (missingTargets.length > 0) {
    fail(
      `export targets missing from the tarball:\n${missingTargets.join('\n')}`
    )
  }
  const nonPublic = [...shipped].filter((path) => NON_PUBLIC_FILE.test(path))
  if (nonPublic.length > 0) {
    fail(`test-only files in the tarball:\n${nonPublic.join('\n')}`)
  }
  const manifest = packedManifest(packed.filename)
  const unrewritten = Object.entries({
    ...manifest.dependencies,
    ...manifest.peerDependencies
  }).filter(([, specifier]) => WORKSPACE_ONLY_SPECIFIER.test(specifier))
  if (unrewritten.length > 0) {
    fail(
      `specifiers only pnpm can rewrite survived packing:\n${unrewritten
        .map(([name, specifier]) => `${name}: ${specifier}`)
        .join('\n')}`
    )
  }
  log(`packed ${shipped.size} files, specifiers rewritten`)
}

const CONSUMER_SOURCE = `
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createLazyIdentity } from '@comfyorg/account/lazyIdentity'
import type { AccountUser } from '@comfyorg/account/session'
import { createSessionClient } from '@comfyorg/account/session'
import { createTestIdentity } from '@comfyorg/account/testing'

const identity = createTestIdentity<AccountUser>({
  onUserChanged: (callback) => {
    callback(null)
    return () => {}
  }
})
const lazyIdentity = createLazyIdentity(async () => identity)
const memory = new Map<string, string>()
const client = createSessionClient(
  {
    exchangeUrl: 'https://example.invalid/api/auth/token',
    storage: {
      read: () => memory.get('credential') ?? null,
      write: (value) => memory.set('credential', value),
      clear: () => memory.delete('credential')
    }
  },
  lazyIdentity
)
const beforeActivation = client.getSnapshot().phase
await lazyIdentity.activate()
const afterActivation = client.getSnapshot().phase
client.dispose()
if (beforeActivation !== 'pending' || afterActivation !== 'signed-out') {
  throw new Error(
    \`session client phases \${beforeActivation} -> \${afterActivation}\`
  )
}
console.log(\`session client: \${beforeActivation} -> \${afterActivation}\`)

const subpaths: string[] = JSON.parse(readFileSync('entries.json', 'utf8'))
for (const subpath of subpaths) {
  const specifier = subpath.replace(/^\\./, '@comfyorg/account')
  const target = fileURLToPath(import.meta.resolve(specifier))
  if (!existsSync(target)) throw new Error(\`\${specifier} resolves to a missing file\`)
  if (target.endsWith('.vue')) {
    console.log(\`\${specifier}: resolved (Vue SFC, needs a bundler to load)\`)
    continue
  }
  await import(specifier)
  console.log(\`\${specifier}: imported\`)
}
`

function main(): void {
  const source = readManifest(packageDir)
  const consumerDir = mkdtempSync(join(tmpdir(), 'comfyorg-account-smoke-'))
  const tarballDir = join(consumerDir, 'tarballs')
  mkdirSync(tarballDir)
  try {
    const packed = pack(packageDir, tarballDir)
    assertPublishable(source, packed)

    const siblings = workspaceDependencyClosure(
      packageDir,
      workspacePackageDirs()
    )
    const overrides = Object.fromEntries(
      [...siblings].map(([name, dir]) => [
        name,
        `file:${pack(dir, tarballDir).filename}`
      ])
    )
    const peers = packedManifest(packed.filename).peerDependencies ?? {}
    writeFileSync(
      join(consumerDir, 'package.json'),
      JSON.stringify(
        {
          name: 'comfyorg-account-smoke',
          private: true,
          type: 'module',
          dependencies: {
            [source.name]: `file:${packed.filename}`,
            ...peers
          },
          overrides
        },
        null,
        2
      )
    )
    log(`installing into ${consumerDir}`)
    run(
      'npm',
      ['install', '--no-audit', '--no-fund', '--loglevel=error'],
      consumerDir
    )

    writeFileSync(
      join(consumerDir, 'entries.json'),
      JSON.stringify(Object.keys(source.exports))
    )
    writeFileSync(join(consumerDir, 'consumer.ts'), CONSUMER_SOURCE)
    const tsx = join(workspaceRoot, 'node_modules', '.bin', 'tsx')
    process.stdout.write(run(tsx, ['consumer.ts'], consumerDir))
    log('packed tarball smoke test passed')
  } finally {
    if (keep) log(`kept ${consumerDir}`)
    else rmSync(consumerDir, { recursive: true, force: true })
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
