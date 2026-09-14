import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'astro/zod'

import {
  parseRouterOpenApiSnapshot,
  routerInputSchema
} from '../src/config/workshop-router-openapi'
import { validatorFor } from '../src/config/workshop-json-schema'
import { isDirectExecution } from './script-entry-point'

export function packRouterSchemas(
  input: unknown,
  sourceCommit: string
): string {
  const records = z
    .array(z.object({ id: z.string(), document: z.unknown() }))
    .parse(input)
    .map((entry) => parseRouterOpenApiSnapshot({ ...entry, sourceCommit }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  if (new Set(records.map((entry) => entry.id)).size !== records.length)
    throw new Error('Duplicate Router model IDs')
  if (!records.length) throw new Error('Refusing an empty Router snapshot')
  for (const record of records) validatorFor(routerInputSchema(record))
  return `[\n${records.map((entry) => JSON.stringify(entry)).join(',\n')}\n]\n`
}

async function main() {
  const [input, sourceCommit] = process.argv.slice(2)
  if (!input || !sourceCommit)
    throw new Error(
      'Usage: generate-workshop-router-snapshot <documents.json> <backend-commit>'
    )
  const packed = packRouterSchemas(
    JSON.parse(await readFile(input, 'utf8')),
    sourceCommit
  )
  const output = resolve(
    import.meta.dirname,
    '../src/data/workshop-router-openapi.snapshot.json'
  )
  if ((await readFile(output, 'utf8').catch(() => '')) !== packed)
    await writeFile(output, packed)
  process.stdout.write(
    `Packed ${packed.split('\n').length - 3} Router documents\n`
  )
}

if (isDirectExecution(process.argv[1], import.meta.filename)) await main()
