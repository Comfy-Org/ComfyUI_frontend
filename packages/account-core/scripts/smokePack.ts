/**
 * Packs the three publishable packages, installs the tarballs into a throwaway
 * npm project alongside their declared peers, and proves the published shape
 * from there: plain node imports every built entry and constructs a session
 * client, and tsc under nodenext resolves a type and a value from each entry
 * through the published `types` conditions. This is the consumer path where an
 * unrewritten `catalog:` specifier, an export target missing from the tarball,
 * or an extensionless relative import in the emitted ESM first fails.
 *
 * Tarball shape itself is not decided here: `publishableTarball.ts` owns those
 * rules, and CI runs them per package through `checkPublishable.ts`.
 *
 * None of them is on npm yet, so each is also pinned through npm `overrides`;
 * drop an entry from PUBLISHED_PACKAGES once it resolves from the registry.
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
import { z } from 'zod'

import type { PackedPublishable } from './packPublishable'
import { packPublishable, parseJson, run } from './packPublishable'
import type { PublishedManifest } from './publishableTarball'
import { formatViolations } from './publishableTarball'

const zWorkspaceManifest = z.object({
  name: z.string(),
  dependencies: z.record(z.string(), z.string()).optional()
})

type WorkspaceManifest = z.infer<typeof zWorkspaceManifest>

const packageDir = fileURLToPath(new URL('..', import.meta.url))
const workspaceRoot = resolve(packageDir, '..', '..')
const packagesDir = resolve(packageDir, '..')
const keep = process.argv.includes('--keep')

const PUBLISHED_PACKAGES = ['account-core', 'billing-contract', 'ingest-types']

function readWorkspaceManifest(dir: string): WorkspaceManifest {
  const path = join(dir, 'package.json')
  return parseJson(zWorkspaceManifest, readFileSync(path, 'utf8'), path)
}

function workspacePackageDirs(): Map<string, string> {
  return new Map(
    readdirSync(packagesDir)
      .map((entry) => join(packagesDir, entry))
      .filter((dir) => existsSync(join(dir, 'package.json')))
      .map((dir) => [readWorkspaceManifest(dir).name, dir])
  )
}

function workspaceDependencies(
  dir: string,
  dirsByName: Map<string, string>
): Array<[string, string]> {
  return Object.entries(readWorkspaceManifest(dir).dependencies ?? {})
    .filter(([, specifier]) => specifier.startsWith('workspace:'))
    .map(([name]) => [
      name,
      dirsByName.get(name) ?? fail(`workspace dependency ${name} not found`)
    ])
}

function workspaceDependencyClosure(
  dirs: string[],
  dirsByName: Map<string, string>
): Map<string, string> {
  const closure = new Map<string, string>()
  const queue = dirs.flatMap((dir) => workspaceDependencies(dir, dirsByName))
  for (const [name, depDir] of queue) {
    if (closure.has(name)) continue
    closure.set(name, depDir)
    queue.push(...workspaceDependencies(depDir, dirsByName))
  }
  return closure
}

function log(line: string): void {
  process.stdout.write(`${line}\n`)
}

function fail(message: string): never {
  throw new Error(message)
}

function packOrFail(dir: string, destination: string): PackedPublishable {
  const packed = packPublishable(dir, destination)
  if (packed.violations.length > 0) {
    fail(`${packed.manifest.name}\n${formatViolations(packed.violations)}`)
  }
  log(
    `packed ${packed.manifest.name}: ${packed.files.length} files, specifiers rewritten`
  )
  return packed
}

const NODE_CONSUMER_SOURCE = `
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createSessionClient } from '@comfyorg/account-core/session'
import { createTestIdentity } from '@comfyorg/account-core/testing'
import { buildBillingEntryUrl } from '@comfyorg/billing-contract'
import { zExchangeTokenResponse } from '@comfyorg/ingest-types/zod'

const memory = new Map()
const client = createSessionClient({
  exchangeUrl: 'https://example.invalid/api/auth/token',
  storage: {
    read: () => memory.get('credential') ?? null,
    write: (value) => memory.set('credential', value),
    clear: () => memory.delete('credential')
  }
})
const beforeIdentity = client.getSnapshot().phase
const detach = client.attachIdentity(
  createTestIdentity({
    onUserChanged: (callback) => {
      callback(null)
      return () => {}
    }
  })
)
const afterIdentity = client.getSnapshot().phase
detach()
if (beforeIdentity !== 'pending' || afterIdentity !== 'signed-out') {
  throw new Error(
    \`session client phases \${beforeIdentity} -> \${afterIdentity}\`
  )
}
console.log(\`session client: \${beforeIdentity} -> \${afterIdentity}\`)

const entry = buildBillingEntryUrl({
  billingOrigin: 'https://billing.comfy.org',
  intent: 'checkout',
  product: 'comfyui',
  returnTo: 'comfyui_workspace'
})
if (entry.status !== 'ok') {
  throw new Error(\`@comfyorg/billing-contract built no entry URL: \${entry.code}\`)
}
console.log(\`billing entry URL: \${entry.url.href}\`)

if (typeof zExchangeTokenResponse.parse !== 'function') {
  throw new Error('@comfyorg/ingest-types/zod did not load a zod schema')
}
console.log('@comfyorg/ingest-types/zod: imported under node')

for (const name of PACKAGES) {
  const { default: manifest } = await import(\`\${name}/package.json\`, {
    with: { type: 'json' }
  })
  for (const subpath of Object.keys(manifest.exports)) {
    const specifier = subpath.replace(/^\\./, name)
    const target = fileURLToPath(import.meta.resolve(specifier))
    if (!existsSync(target)) {
      throw new Error(\`\${specifier} resolves to a missing file\`)
    }
    if (target.endsWith('.json')) {
      await import(specifier, { with: { type: 'json' } })
    } else {
      await import(specifier)
    }
    console.log(\`\${specifier}: imported under node\`)
  }
}
`

const TYPED_CONSUMER_SOURCE = `
import type { OperationHandle } from '@comfyorg/account-core/boundedOperation'
import { createBoundedOperation } from '@comfyorg/account-core/boundedOperation'
import type { AccountUser, SessionSnapshot } from '@comfyorg/account-core/session'
import { createSessionClient } from '@comfyorg/account-core/session'
import type { BillingErrorCode } from '@comfyorg/account-core/billing'
import { createSessionBillingTransport } from '@comfyorg/account-core/billing'
import type { FirebaseIdentityAppConfig } from '@comfyorg/account-core/firebase'
import { createFirebaseIdentity } from '@comfyorg/account-core/firebase'
import { createWebCrossTabRefreshPort } from '@comfyorg/account-core/web'
import type { IdentityPort } from '@comfyorg/account-core/testing'
import { createTestIdentity } from '@comfyorg/account-core/testing'
import type { CustomerRecoveryDeps } from '@comfyorg/account-core/customerRecovery'
import { MISSING_CUSTOMER_MESSAGE } from '@comfyorg/account-core/customerRecovery'
import type { AuthSchemaMessageKey } from '@comfyorg/account-core/signInSchemas'
import { PASSWORD_RULES } from '@comfyorg/account-core/signInSchemas'
import type { TurnstileMode } from '@comfyorg/account-core/turnstile'
import { normalizeTurnstileMode } from '@comfyorg/account-core/turnstile'
import type { TurnstileRenderOptions } from '@comfyorg/account-core/turnstileScript'
import { loadTurnstile } from '@comfyorg/account-core/turnstileScript'
import type { FirebaseAuthErrorLike } from '@comfyorg/account-core/firebaseAuthError'
import { isFirebaseAuthErrorLike } from '@comfyorg/account-core/firebaseAuthError'
import { signUpWithProvisioning } from '@comfyorg/account-core/provisioning'
import { safeInternalPath } from '@comfyorg/account-core/redirect'
import type { AuthMethod } from '@comfyorg/account-core/telemetry'
import { SESSION_TELEMETRY_EVENT } from '@comfyorg/account-core/telemetry'
import { isEmbeddedWebView } from '@comfyorg/account-core/webviewDetection'
import type { BillingEntry, ReturnTarget } from '@comfyorg/billing-contract'
import { buildBillingEntryUrl, parseBillingEntry } from '@comfyorg/billing-contract'
import type { ExchangeTokenResponse } from '@comfyorg/ingest-types'
import { zExchangeTokenResponse } from '@comfyorg/ingest-types/zod'

export const values = {
  createBoundedOperation,
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
  SESSION_TELEMETRY_EVENT,
  isEmbeddedWebView,
  buildBillingEntryUrl,
  parseBillingEntry,
  zExchangeTokenResponse
}

export interface Types {
  boundedOperation: OperationHandle
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
  telemetry: AuthMethod
  webviewDetection: ReturnType<typeof isEmbeddedWebView>
  billingContract: BillingEntry
  returnTarget: ReturnTarget
  ingestTypes: ExchangeTokenResponse
}

export interface RejectedByRealDeclarations {
  // @ts-expect-error an any-typed declaration would accept this
  session: SessionSnapshot['noSuchProperty']
  // @ts-expect-error an any-typed declaration would accept this
  billingContract: BillingEntry['noSuchProperty']
  // @ts-expect-error an any-typed declaration would accept this
  ingestTypes: ExchangeTokenResponse['noSuchProperty']
}
`

function assertTypedConsumerCoversEveryExport(
  manifests: PublishedManifest[]
): void {
  const uncovered = manifests
    .flatMap((manifest) =>
      Object.keys(manifest.exports)
        .filter((subpath) => subpath !== './package.json')
        .map((subpath) => subpath.replace(/^\.$/, '').replace(/^\./, ''))
        .map((suffix) => `${manifest.name}${suffix}`)
    )
    .filter((specifier) => !TYPED_CONSUMER_SOURCE.includes(`'${specifier}'`))
  if (uncovered.length > 0) {
    fail(
      `TYPED_CONSUMER_SOURCE does not import these exports:\n${uncovered.join('\n')}`
    )
  }
}

function main(): void {
  const consumerDir = mkdtempSync(join(tmpdir(), 'comfyorg-packages-smoke-'))
  const tarballDir = join(consumerDir, 'tarballs')
  mkdirSync(tarballDir)
  try {
    const dirsByName = workspacePackageDirs()
    const rootDirs = PUBLISHED_PACKAGES.map((name) => join(packagesDir, name))
    const packedRoots = rootDirs.map((dir) => packOrFail(dir, tarballDir))
    const manifests = packedRoots.map((packed) => packed.manifest)
    assertTypedConsumerCoversEveryExport(manifests)

    const directDependencies = Object.fromEntries(
      manifests.map((manifest, index) => [
        manifest.name,
        `file:${packedRoots[index].filename}`
      ])
    )
    const siblings = workspaceDependencyClosure(rootDirs, dirsByName)
    const overrides = {
      ...Object.fromEntries(
        [...siblings]
          .filter(([name]) => !(name in directDependencies))
          .map(([name, dir]) => [
            name,
            `file:${packOrFail(dir, tarballDir).filename}`
          ])
      ),
      ...directDependencies
    }
    writeFileSync(
      join(consumerDir, 'package.json'),
      JSON.stringify(
        {
          name: 'comfyorg-packages-smoke',
          private: true,
          type: 'module',
          dependencies: {
            ...directDependencies,
            ...Object.assign(
              {},
              ...manifests.map((manifest) => manifest.peerDependencies ?? {})
            )
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
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--loglevel=error'
      ],
      consumerDir
    )

    const packageList = manifests
      .map((manifest) => `'${manifest.name}'`)
      .join(', ')
    writeFileSync(
      join(consumerDir, 'consumer.mjs'),
      `const PACKAGES = [${packageList}]\n${NODE_CONSUMER_SOURCE}`
    )
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
