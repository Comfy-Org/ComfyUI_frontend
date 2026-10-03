import { execFileSync } from 'node:child_process'
import { readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { z } from 'zod'

import { packRouterSchemas } from './generate-workshop-router-snapshot'
import { isDirectExecution } from './script-entry-point'

const routerSchemasPath = 'services/comfy-api/docs/router-schemas'
const websiteRoot = resolve(import.meta.dirname, '..')
const snapshotFile = 'src/data/workshop-router-openapi.snapshot.json'
const snapshotPath = join(websiteRoot, snapshotFile)

const packedRecords = z.array(z.object({ id: z.string() }))

export async function collectRouterSchemaDocuments(
  root: string
): Promise<{ id: string; document: unknown }[]> {
  const documents: { id: string; document: unknown }[] = []
  for (const provider of await readdir(root, { withFileTypes: true })) {
    if (provider.name.startsWith('.')) continue
    if (provider.isFile() && provider.name === 'README.md') continue
    if (!provider.isDirectory())
      throw new Error(`Unexpected Router schema entry: ${provider.name}`)
    const providerPath = join(root, provider.name)
    for (const model of await readdir(providerPath, { withFileTypes: true })) {
      if (model.name.startsWith('.')) continue
      if (!model.isFile() || !model.name.endsWith('.json'))
        throw new Error(
          `Unexpected Router schema entry: ${provider.name}/${model.name}`
        )
      const id = `${provider.name}/${model.name.slice(0, -'.json'.length)}`
      const text = await readFile(join(providerPath, model.name), 'utf8')
      let document: unknown
      try {
        document = JSON.parse(text)
      } catch (error) {
        throw new Error(`Router schema ${id} is not valid JSON`, {
          cause: error
        })
      }
      documents.push({ id, document })
    }
  }
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

function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
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
  const baseline = committedSnapshot() ?? onDisk ?? '[]'

  // Validate both sides and report the change before anything is written.
  const before = idsOf(baseline, 'The committed snapshot')
  const after = idsOf(packed, 'The packed snapshot')
  const added = [...after].filter((id) => !before.has(id))
  const removed = [...before].filter((id) => !after.has(id))
  process.stdout.write(
    [
      `Packed ${after.size} Router documents from ${sourceCommit}`,
      `Added since HEAD (${added.length}): ${added.join(', ') || 'none'}`,
      `Removed since HEAD (${removed.length}): ${removed.join(', ') || 'none'}`
    ].join('\n') + '\n'
  )

  if (onDisk !== packed) {
    const staged = `${snapshotPath}.tmp`
    await writeFile(staged, packed)
    await rename(staged, snapshotPath)
  }

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

if (isDirectExecution(process.argv[1], import.meta.filename)) await main()
