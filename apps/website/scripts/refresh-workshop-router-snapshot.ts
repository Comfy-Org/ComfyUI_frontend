import { execFileSync } from 'node:child_process'
import { readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

import { websiteRoot } from '@website/paths'

import { packRouterSchemas } from './generate-workshop-router-snapshot'
import { isDirectExecution } from './script-entry-point'

const routerSchemasPath = 'services/comfy-api/docs/router-schemas'
const snapshotFile = 'src/data/workshop-router-openapi.snapshot.json'
const snapshotPath = join(websiteRoot, snapshotFile)

const packedRecords = z.array(z.object({ id: z.string() }))

type RouterSchemaDocument = { id: string; document: unknown }

function parseDocument(id: string, text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Router schema ${id} is not valid JSON`, { cause: error })
  }
}

async function readProviderDocuments(
  root: string,
  provider: string
): Promise<RouterSchemaDocument[]> {
  const providerPath = join(root, provider)
  const documents: RouterSchemaDocument[] = []
  for (const model of await readdir(providerPath, { withFileTypes: true })) {
    if (model.name.startsWith('.')) continue
    if (!model.isFile() || !model.name.endsWith('.json'))
      throw new Error(
        `Unexpected Router schema entry: ${provider}/${model.name}`
      )
    const id = `${provider}/${model.name.slice(0, -'.json'.length)}`
    const text = await readFile(join(providerPath, model.name), 'utf8')
    documents.push({ id, document: parseDocument(id, text) })
  }
  return documents
}

async function providerDirectories(root: string): Promise<string[]> {
  const providers: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'README.md') continue
    if (!entry.isDirectory())
      throw new Error(`Unexpected Router schema entry: ${entry.name}`)
    providers.push(entry.name)
  }
  return providers
}

export async function collectRouterSchemaDocuments(
  root: string
): Promise<RouterSchemaDocument[]> {
  const documents: RouterSchemaDocument[] = []
  for (const provider of await providerDirectories(root))
    documents.push(...(await readProviderDocuments(root, provider)))
  if (!documents.length)
    throw new Error(`No Router schema documents under ${root}`)
  return documents.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function idsOf(packed: string, source: string): Set<string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(packed)
  } catch (error) {
    throw new Error(`${source} is not valid JSON`, { cause: error })
  }
  return new Set(packedRecords.parse(parsed).map((record) => record.id))
}

// The committed snapshot is several MB, past execFileSync's 1 MiB default.
const gitMaxBuffer = 256 * 1024 * 1024

function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    maxBuffer: gitMaxBuffer,
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()
}

/**
 * The commit every packed record is stamped with. The documents are read
 * from the checkout's working tree, so the tree under router-schemas must be
 * clean and an explicit SHA must name the checked-out commit; otherwise the
 * stamp would describe bytes the snapshot does not contain.
 */
export function resolveSourceCommit(
  cloudCheckout: string,
  explicit?: string
): string {
  if (git(cloudCheckout, ['status', '--porcelain', '--', routerSchemasPath]))
    throw new Error(
      `Uncommitted changes under ${routerSchemasPath} in ${cloudCheckout}; commit or stash them first`
    )
  const head = git(cloudCheckout, ['rev-parse', '--verify', 'HEAD^{commit}'])
  if (explicit === undefined) return head
  const named = git(cloudCheckout, [
    'rev-parse',
    '--verify',
    `${explicit}^{commit}`
  ])
  if (named !== head)
    throw new Error(
      `${explicit} is not the checked-out commit ${head}; check it out first`
    )
  return head
}

async function readIfPresent(path: string): Promise<string | undefined> {
  return readFile(path, 'utf8').catch((error: unknown) => {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return undefined
    throw error
  })
}

/** The committed snapshot, so a re-run reports the same added/removed ids. */
function committedSnapshot(): string | undefined {
  try {
    return git(websiteRoot, ['show', `HEAD:./${snapshotFile}`])
  } catch {
    return undefined
  }
}

function listOrNone(ids: string[]): string {
  return ids.join(', ') || 'none'
}

/** Validates both snapshots and describes the change between them. */
export function describeChange(
  baseline: string,
  packed: string,
  sourceCommit: string
): string {
  const before = idsOf(baseline, 'The committed snapshot')
  const after = idsOf(packed, 'The packed snapshot')
  const added = [...after].filter((id) => !before.has(id))
  const removed = [...before].filter((id) => !after.has(id))
  return [
    `Packed ${after.size} Router documents from ${sourceCommit}`,
    `Added since HEAD (${added.length}): ${listOrNone(added)}`,
    `Removed since HEAD (${removed.length}): ${listOrNone(removed)}`
  ].join('\n')
}

async function writeSnapshot(onDisk: string | undefined, packed: string) {
  if (onDisk === packed) return
  const staged = `${snapshotPath}.tmp`
  await writeFile(staged, packed)
  await rename(staged, snapshotPath)
}

function runGenerators() {
  const failed: string[] = []
  for (const script of [
    'generate-workshop-router-contracts.ts',
    'generate-workshop-router-aliases.ts'
  ]) {
    try {
      execFileSync(
        process.execPath,
        ['--import', 'tsx', join(import.meta.dirname, script)],
        { cwd: websiteRoot, stdio: 'inherit' }
      )
    } catch {
      failed.push(script)
    }
  }
  if (failed.length)
    throw new Error(
      `${failed.join(' and ')} stopped; recheck the availability and identity-audit files, then re-run`
    )
}

async function main() {
  const [cloudCheckout, commitArgument] = process.argv.slice(2)
  if (!cloudCheckout)
    throw new Error(
      'Usage: refresh-workshop-router-snapshot <cloud-checkout> [<cloud-sha>]'
    )
  const sourceCommit = resolveSourceCommit(cloudCheckout, commitArgument)
  const packed = packRouterSchemas(
    await collectRouterSchemaDocuments(join(cloudCheckout, routerSchemasPath)),
    sourceCommit
  )
  const onDisk = await readIfPresent(snapshotPath)
  // Report the change before anything is written.
  process.stdout.write(
    `${describeChange(committedSnapshot() ?? onDisk ?? '[]', packed, sourceCommit)}\n`
  )
  await writeSnapshot(onDisk, packed)
  runGenerators()
}

if (isDirectExecution(process.argv[1], import.meta.filename)) await main()
