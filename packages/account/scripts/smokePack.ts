/**
 * Packs @comfyorg/account with `pnpm pack`, installs the tarball into a
 * throwaway npm project alongside the declared peers, and proves the published
 * shape from there: plain node imports every built entry, tsc under nodenext
 * resolves a type and a value from each through the published `types`
 * conditions, and the Vue SFC entries resolve their declaration and ship their
 * source for a bundler. This is the consumer path where an unrewritten
 * `catalog:` specifier or an export target missing from the tarball first
 * fails.
 *
 * ingest-types is not on npm yet, so it is packed too and pinned through npm
 * `overrides`; drop that once it is published.
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

type ExportTarget = string | { readonly types: string; readonly import: string }

interface Manifest {
  readonly name: string
  readonly version: string
  readonly exports: Readonly<Record<string, ExportTarget>>
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
const NON_PUBLIC_FILE = /(\.test\.ts$|(^|\/)__fixtures__\/|^src\/)/

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

function targetFiles(target: ExportTarget): string[] {
  return typeof target === 'string' ? [target] : [target.types, target.import]
}

function log(line: string): void {
  process.stdout.write(`${line}\n`)
}

function fail(message: string): never {
  throw new Error(message)
}

function assertPublishable(packed: PackResult): Manifest {
  const manifest = packedManifest(packed.filename)
  const shipped = new Set(packed.files.map((file) => file.path))
  const missingTargets = Object.values(manifest.exports)
    .flatMap(targetFiles)
    .map((target) => target.replace(/^\.\//, ''))
    .filter((target) => !shipped.has(target))
  if (missingTargets.length > 0) {
    fail(
      `export targets missing from the tarball:\n${missingTargets.join('\n')}`
    )
  }
  const nonPublic = [...shipped].filter((path) => NON_PUBLIC_FILE.test(path))
  if (nonPublic.length > 0) {
    fail(`source or test-only files in the tarball:\n${nonPublic.join('\n')}`)
  }
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
  log(`packed ${manifest.name}: ${shipped.size} files, specifiers rewritten`)
  return manifest
}

const NODE_CONSUMER_SOURCE = `
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createLazyIdentity } from '@comfyorg/account/lazyIdentity'
import { createSessionClient } from '@comfyorg/account/session'
import { createTestIdentity } from '@comfyorg/account/testing'
import { zExchangeTokenResponse } from '@comfyorg/ingest-types/zod'

const identity = createTestIdentity({
  onUserChanged: (callback) => {
    callback(null)
    return () => {}
  }
})
const lazyIdentity = createLazyIdentity(async () => identity)
const memory = new Map()
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
if (typeof zExchangeTokenResponse.parse !== 'function') {
  throw new Error('@comfyorg/ingest-types/zod did not load a zod schema')
}
console.log('@comfyorg/ingest-types/zod: imported under node')

const { default: manifest } = await import('@comfyorg/account/package.json', {
  with: { type: 'json' }
})
for (const subpath of Object.keys(manifest.exports)) {
  const specifier = subpath.replace(/^\\./, '@comfyorg/account')
  const target = fileURLToPath(import.meta.resolve(specifier))
  if (!existsSync(target)) throw new Error(\`\${specifier} resolves to a missing file\`)
  if (target.endsWith('.vue')) {
    console.log(\`\${specifier}: source shipped for a bundler (\${target.slice(target.lastIndexOf('/dist/') + 1)})\`)
    continue
  }
  if (target.endsWith('.json')) await import(specifier, { with: { type: 'json' } })
  else await import(specifier)
  console.log(\`\${specifier}: imported under node\`)
}
`

const TYPED_CONSUMER_SOURCE = `
import type { OperationHandle } from '@comfyorg/account/boundedOperation'
import { createBoundedOperation } from '@comfyorg/account/boundedOperation'
import type { LazyIdentity } from '@comfyorg/account/lazyIdentity'
import { createLazyIdentity } from '@comfyorg/account/lazyIdentity'
import type { AccountUser, SessionSnapshot } from '@comfyorg/account/session'
import { SESSION_ERROR_CODES, createSessionClient } from '@comfyorg/account/session'
import type { BillingErrorCode } from '@comfyorg/account/billing'
import { createSessionBillingTransport } from '@comfyorg/account/billing'
import type { FirebaseIdentityAppConfig } from '@comfyorg/account/firebase'
import { createFirebaseIdentity } from '@comfyorg/account/firebase'
import { createWebCrossTabRefreshPort } from '@comfyorg/account/web'
import type { IdentityPort } from '@comfyorg/account/testing'
import { createTestIdentity } from '@comfyorg/account/testing'
import type { CustomerRecoveryDeps } from '@comfyorg/account/customerRecovery'
import { MISSING_CUSTOMER_MESSAGE } from '@comfyorg/account/customerRecovery'
import type { AuthSchemaMessageKey } from '@comfyorg/account/signInSchemas'
import { PASSWORD_RULES } from '@comfyorg/account/signInSchemas'
import type { TurnstileMode } from '@comfyorg/account/turnstile'
import { normalizeTurnstileMode } from '@comfyorg/account/turnstile'
import type { TurnstileRenderOptions } from '@comfyorg/account/turnstileScript'
import { loadTurnstile } from '@comfyorg/account/turnstileScript'
import type { FirebaseAuthErrorLike } from '@comfyorg/account/firebaseAuthError'
import { isFirebaseAuthErrorLike } from '@comfyorg/account/firebaseAuthError'
import { signUpWithProvisioning } from '@comfyorg/account/provisioning'
import { safeInternalPath } from '@comfyorg/account/redirect'
import { getClientCountry } from '@comfyorg/account/region'
import type { AuthMethod } from '@comfyorg/account/telemetry'
import { SESSION_TELEMETRY_EVENT } from '@comfyorg/account/telemetry'
import { isEmbeddedWebView } from '@comfyorg/account/webviewDetection'
import type { RegionGateStatus } from '@comfyorg/account/vue/regionGate'
import { useRegionGate } from '@comfyorg/account/vue/regionGate'
import { useTurnstileGate } from '@comfyorg/account/vue/turnstileGate'
import type { LifecycleScope } from '@comfyorg/account/vue/lifecycleScope'
import { createLifecycleScope } from '@comfyorg/account/vue/lifecycleScope'
import { useGenerationGuard } from '@comfyorg/account/vue/useGenerationGuard'
import type PasswordRules from '@comfyorg/account/vue/PasswordRules'
import type SocialAuthButtons from '@comfyorg/account/vue/SocialAuthButtons'
import type TurnstileWidget from '@comfyorg/account/vue/TurnstileWidget'
import type { ExchangeTokenResponse } from '@comfyorg/ingest-types'
import { zExchangeTokenResponse } from '@comfyorg/ingest-types/zod'

export const values = {
  createBoundedOperation,
  createLazyIdentity,
  SESSION_ERROR_CODES,
  createSessionClient,
  createSessionBillingTransport,
  createFirebaseIdentity,
  createWebCrossTabRefreshPort,
  createTestIdentity,
  MISSING_CUSTOMER_MESSAGE,
  PASSWORD_RULES,
  normalizeTurnstileMode,
  loadTurnstile,
  isFirebaseAuthErrorLike,
  signUpWithProvisioning,
  safeInternalPath,
  getClientCountry,
  SESSION_TELEMETRY_EVENT,
  isEmbeddedWebView,
  useRegionGate,
  useTurnstileGate,
  createLifecycleScope,
  useGenerationGuard,
  zExchangeTokenResponse
}

export interface Types {
  boundedOperation: OperationHandle
  lazyIdentity: LazyIdentity<AccountUser>
  session: SessionSnapshot
  billing: BillingErrorCode
  firebase: FirebaseIdentityAppConfig
  web: ReturnType<typeof createWebCrossTabRefreshPort>
  testing: IdentityPort<AccountUser>
  customerRecovery: CustomerRecoveryDeps
  signInSchemas: AuthSchemaMessageKey
  turnstile: TurnstileMode
  turnstileScript: TurnstileRenderOptions
  firebaseAuthError: FirebaseAuthErrorLike
  provisioning: Parameters<typeof signUpWithProvisioning>[0]
  redirect: ReturnType<typeof safeInternalPath>
  region: Awaited<ReturnType<typeof getClientCountry>>
  telemetry: AuthMethod
  webviewDetection: ReturnType<typeof isEmbeddedWebView>
  regionGate: RegionGateStatus
  turnstileGate: ReturnType<typeof useTurnstileGate>
  lifecycleScope: LifecycleScope
  useGenerationGuard: ReturnType<typeof useGenerationGuard>
  passwordRules: InstanceType<typeof PasswordRules>['$props']['password']
  socialAuthButtons: InstanceType<typeof SocialAuthButtons>['$props']['googleLabel']
  turnstileWidget: InstanceType<typeof TurnstileWidget>['$props']['siteKey']
  ingestTypes: ExchangeTokenResponse
}

export const exchange: Types['ingestTypes'] = zExchangeTokenResponse.parse({})
`

function assertTypedConsumerCoversEveryExport(manifest: Manifest): void {
  const uncovered = Object.keys(manifest.exports)
    .filter((subpath) => subpath !== './package.json')
    .map((subpath) => subpath.replace(/^\./, manifest.name))
    .filter((specifier) => !TYPED_CONSUMER_SOURCE.includes(`'${specifier}'`))
  if (uncovered.length > 0) {
    fail(
      `TYPED_CONSUMER_SOURCE does not import these exports:\n${uncovered.join('\n')}`
    )
  }
}

function main(): void {
  const consumerDir = mkdtempSync(join(tmpdir(), 'comfyorg-account-smoke-'))
  const tarballDir = join(consumerDir, 'tarballs')
  mkdirSync(tarballDir)
  try {
    const packed = pack(packageDir, tarballDir)
    const manifest = assertPublishable(packed)
    assertTypedConsumerCoversEveryExport(manifest)

    const siblings = workspaceDependencyClosure(
      packageDir,
      workspacePackageDirs()
    )
    const overrides = Object.fromEntries(
      [...siblings].map(([name, dir]) => {
        const packedSibling = pack(dir, tarballDir)
        assertPublishable(packedSibling)
        return [name, `file:${packedSibling.filename}`]
      })
    )
    writeFileSync(
      join(consumerDir, 'package.json'),
      JSON.stringify(
        {
          name: 'comfyorg-account-smoke',
          private: true,
          type: 'module',
          dependencies: {
            [manifest.name]: `file:${packed.filename}`,
            ...manifest.peerDependencies
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

    writeFileSync(join(consumerDir, 'consumer.mjs'), NODE_CONSUMER_SOURCE)
    process.stdout.write(run('node', ['consumer.mjs'], consumerDir))

    writeFileSync(join(consumerDir, 'consumer.ts'), TYPED_CONSUMER_SOURCE)
    const tsc = join(workspaceRoot, 'node_modules', '.bin', 'tsc')
    execFileSync(
      tsc,
      [
        '--noEmit',
        '--module',
        'nodenext',
        '--moduleResolution',
        'nodenext',
        '--strict',
        'consumer.ts'
      ],
      { cwd: consumerDir, stdio: 'inherit' }
    )
    log('tsc (nodenext, strict): a type and a value resolved from every entry')
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
