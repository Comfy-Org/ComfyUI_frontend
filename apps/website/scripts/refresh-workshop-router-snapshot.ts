import { execFileSync } from 'node:child_process'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { packRouterSchemas } from './generate-workshop-router-snapshot'
import { isDirectExecution } from './script-entry-point'

const routerSchemasPath = 'services/comfy-api/docs/router-schemas'
const snapshotPath = resolve(
  import.meta.dirname,
  '../src/data/workshop-router-openapi.snapshot.json'
)

export async function collectRouterSchemaDocuments(
  root: string
): Promise<{ id: string; document: unknown }[]> {
  const documents: { id: string; document: unknown }[] = []
  for (const provider of await readdir(root, { withFileTypes: true })) {
    if (provider.isFile() && provider.name === 'README.md') continue
    if (!provider.isDirectory())
      throw new Error(`Unexpected Router schema entry: ${provider.name}`)
    const providerPath = join(root, provider.name)
    for (const model of await readdir(providerPath, { withFileTypes: true })) {
      if (!model.isFile() || !model.name.endsWith('.json'))
        throw new Error(
          `Unexpected Router schema entry: ${provider.name}/${model.name}`
        )
      documents.push({
        id: `${provider.name}/${model.name.slice(0, -'.json'.length)}`,
        document: JSON.parse(
          await readFile(join(providerPath, model.name), 'utf8')
        )
      })
    }
  }
  if (!documents.length)
    throw new Error(`No Router schema documents under ${root}`)
  return documents.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function idsOf(packed: string): Set<string> {
  const records: { id: string }[] = JSON.parse(packed)
  return new Set(records.map((record) => record.id))
}

function resolveSourceCommit(cloudCheckout: string, explicit?: string) {
  return (
    explicit ??
    execFileSync('git', ['-C', cloudCheckout, 'rev-parse', 'HEAD'], {
      encoding: 'utf8'
    }).trim()
  )
}

async function main() {
  const [cloudCheckout, commitArgument] = process.argv.slice(2)
  if (!cloudCheckout)
    throw new Error(
      'Usage: refresh-workshop-router-snapshot <cloud-checkout> [<cloud-sha>]'
    )
  const sourceCommit = resolveSourceCommit(cloudCheckout, commitArgument)
  if (!/^[a-f0-9]{40}$/.test(sourceCommit))
    throw new Error(`Expected a full cloud commit SHA, got: ${sourceCommit}`)
  const packed = packRouterSchemas(
    await collectRouterSchemaDocuments(join(cloudCheckout, routerSchemasPath)),
    sourceCommit
  )
  const previous = await readFile(snapshotPath, 'utf8').catch(() => '[]')
  if (previous !== packed) await writeFile(snapshotPath, packed)

  const before = idsOf(previous)
  const after = idsOf(packed)
  const added = [...after].filter((id) => !before.has(id))
  const removed = [...before].filter((id) => !after.has(id))
  process.stdout.write(
    [
      `Packed ${after.size} Router documents from ${sourceCommit}`,
      `Added (${added.length}): ${added.join(', ') || 'none'}`,
      `Removed (${removed.length}): ${removed.join(', ') || 'none'}`
    ].join('\n') + '\n'
  )

  for (const script of [
    'generate-workshop-router-contracts.ts',
    'generate-workshop-router-aliases.ts'
  ])
    execFileSync('tsx', [join(import.meta.dirname, script)], {
      cwd: resolve(import.meta.dirname, '..'),
      stdio: 'inherit'
    })
}

if (isDirectExecution(process.argv[1], import.meta.filename)) await main()
