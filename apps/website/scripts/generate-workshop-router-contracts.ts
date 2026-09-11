import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'astro/zod'

import {
  workshopBindingSchema,
  workshopContractRecordSchema,
  formForContract
} from '../src/config/workshop-contract'
import { fieldsForDefinition } from '../src/config/workshop-form-definition'
import {
  validateWorkshopInput,
  validatorFor
} from '../src/config/workshop-json-schema'
import {
  parseRouterOpenApiSnapshot,
  routerInputSchema
} from '../src/config/workshop-router-openapi'
import { workshopRouterIndexSchema } from '../src/config/workshop-router-index'
import { curateWorkshopInputs } from './workshop-input-presentation'
import { creatorFormFor, creatorVariantsFor } from './workshop-creator-forms'
import availabilityOverrides from '../src/data/workshop-router-availability.json'
import { isDirectExecution } from './script-entry-point'

const jsonSchema = z.record(z.string(), z.json())
const packedRecordsSchema = z.array(z.unknown())

export function countPackedRecords(packed: string): number {
  const parsed: unknown = JSON.parse(packed)
  return packedRecordsSchema.parse(parsed).length
}

export function compileWorkshopContracts(
  rawSnapshots: unknown,
  rawBindings: unknown = []
): string {
  const snapshots = z
    .array(z.unknown())
    .parse(rawSnapshots)
    .map(parseRouterOpenApiSnapshot)
  const byId = new Map(snapshots.map((entry) => [entry.id, entry]))
  if (byId.size !== snapshots.length)
    throw new Error('Duplicate Router snapshot IDs')
  const bindings = z.array(workshopBindingSchema).parse(rawBindings)
  const byRouterId = new Map(
    bindings.map((binding) => [binding.routerId, binding])
  )
  if (
    byRouterId.size !== bindings.length ||
    new Set(bindings.map((binding) => binding.id)).size !== bindings.length
  )
    throw new Error('Duplicate catalog bindings')
  for (const binding of bindings)
    if (!byId.get(binding.routerId)?.document['x-comfy-input-schema-authored'])
      throw new Error(`Incomplete Router contract: ${binding.routerId}`)
  const records = snapshots
    .filter((snapshot) => snapshot.document['x-comfy-input-schema-authored'])
    .map((snapshot) => {
      const binding = byRouterId.get(snapshot.id)
      const inputSchema = routerInputSchema(snapshot)
      const properties = jsonSchema.parse(inputSchema.properties ?? {})
      const curated = curateWorkshopInputs(
        snapshot.id,
        inputSchema,
        binding?.omit
      )
      const responses =
        snapshot.document.paths[`/v2/models/${snapshot.id}`].post.responses
      if (!Object.hasOwn(responses, '200'))
        throw new Error(`Missing Router response: ${snapshot.id}`)
      const response = responses['200']
      const outputSchema = response.content?.['application/json']?.schema
      const schema = outputSchema
        ? {
            ...outputSchema,
            ...(snapshot.document.components?.schemas
              ? {
                  components: { schemas: snapshot.document.components.schemas }
                }
              : {})
          }
        : undefined
      if (binding?.output.format === 'json' && !schema)
        throw new Error(`Missing JSON output schema: ${snapshot.id}`)
      const contentTypes = new Set(
        Object.keys(response.content ?? { '*/*': {} })
      )
      const stream = properties.stream
      if (
        stream &&
        typeof stream === 'object' &&
        !Array.isArray(stream) &&
        validateWorkshopInput(true, {
          ...stream,
          ...(inputSchema.components
            ? { components: inputSchema.components }
            : {})
        })
      )
        contentTypes.add('text/event-stream')
      const output =
        binding?.output.format === 'json'
          ? { ...binding.output, schema }
          : (binding?.output ?? {
              format: 'auto',
              ...(schema ? { schema } : {}),
              contentTypes: [...contentTypes]
            })
      const creatorVariants = creatorVariantsFor(snapshot.id, curated)
      const record = workshopContractRecordSchema.parse({
        catalogId: binding?.id ?? snapshot.id,
        id: snapshot.id,
        sourceCommit: snapshot.sourceCommit,
        ...curated,
        creator: creatorFormFor(snapshot.id, curated),
        ...(Object.keys(creatorVariants).length ? { creatorVariants } : {}),
        media: binding?.media ?? [],
        advancedFields: [],
        output
      })
      validatorFor(record.inputSchema)
      if (record.output.format !== 'binary' && record.output.schema)
        validatorFor(record.output.schema)
      const fields = fieldsForDefinition(formForContract(record))
      const inputs = new Map(
        Object.entries(record.creator?.inputs ?? record.inputs ?? {})
      )
      return {
        ...record,
        advancedFields: fields
          .filter(
            (field) =>
              inputs.get(field.name)?.advanced ??
              binding?.advancedFields.includes(field.name)
          )
          .map((field) => field.name)
      }
    })
    .sort((a, b) =>
      a.catalogId < b.catalogId ? -1 : a.catalogId > b.catalogId ? 1 : 0
    )
  if (
    new Set(records.map((record) => record.catalogId)).size !== records.length
  )
    throw new Error('Duplicate resolved catalog IDs')
  return `[\n${records.map((record) => JSON.stringify(record)).join(',\n')}\n]\n`
}

export function compileWorkshopIndex(
  rawSnapshots: unknown,
  rawContracts: unknown,
  rawAvailability: unknown = availabilityOverrides
): string {
  const availability = new Map(
    Object.entries(
      z
        .record(
          z.string(),
          z.object({
            sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
            reason: z.literal('router-not-enabled')
          })
        )
        .parse(rawAvailability)
    )
  )
  const snapshots = z
    .array(z.unknown())
    .parse(rawSnapshots)
    .map(parseRouterOpenApiSnapshot)
  const contracts = z.array(workshopContractRecordSchema).parse(rawContracts)
  const byId = new Map(contracts.map((contract) => [contract.id, contract]))
  const snapshotIds = new Set(snapshots.map((snapshot) => snapshot.id))
  if (
    byId.size !== contracts.length ||
    snapshotIds.size !== snapshots.length ||
    contracts.some((contract) => !snapshotIds.has(contract.id))
  )
    throw new Error('Router index and contracts do not match')
  const records = workshopRouterIndexSchema
    .parse(
      snapshots.map((snapshot) => {
        const override = availability.get(snapshot.id)
        if (override && override.sourceCommit !== snapshot.sourceCommit)
          throw new Error(
            `Recheck Router availability against the new snapshot: ${snapshot.id}`
          )
        const contract = byId.get(snapshot.id)
        if (
          Boolean(contract) !==
          snapshot.document['x-comfy-input-schema-authored']
        )
          throw new Error(`Router index contract mismatch: ${snapshot.id}`)
        const responses =
          snapshot.document.paths[`/v2/models/${snapshot.id}`].post.responses
        const output = Object.hasOwn(responses, '200')
          ? responses['200']
          : undefined
        const description = contract
          ? contract.inputSchema.description
          : snapshot.document['x-comfy-output-schema-authored']
            ? output?.content?.['application/json']?.schema.description
            : undefined
        return {
          id: snapshot.id,
          catalogId: contract?.catalogId ?? snapshot.id,
          ...(typeof description === 'string' ? { description } : {}),
          ...(override ? { unavailableReason: override.reason } : {}),
          ...(!contract ? { incompleteReason: 'missing-input-schema' } : {})
        }
      })
    )
    .sort((a, b) =>
      a.catalogId < b.catalogId ? -1 : a.catalogId > b.catalogId ? 1 : 0
    )
  if (
    new Set(records.map((record) => record.catalogId)).size !== records.length
  )
    throw new Error('Duplicate Router index catalog IDs')
  return `[\n${records.map((record) => JSON.stringify(record)).join(',\n')}\n]\n`
}

async function main() {
  const [
    snapshotPath = resolve(
      import.meta.dirname,
      '../src/data/workshop-router-openapi.snapshot.json'
    ),
    bindingsPath = resolve(
      import.meta.dirname,
      '../src/data/workshop-router-bindings.json'
    )
  ] = process.argv.slice(2)
  const snapshots: unknown = JSON.parse(await readFile(snapshotPath, 'utf8'))
  const packed = compileWorkshopContracts(
    snapshots,
    JSON.parse(await readFile(bindingsPath, 'utf8'))
  )
  const output = resolve(
    import.meta.dirname,
    '../src/content/workshop-router-contracts.json'
  )
  if ((await readFile(output, 'utf8').catch(() => '')) !== packed)
    await writeFile(output, packed)
  const index = compileWorkshopIndex(snapshots, JSON.parse(packed))
  const indexPath = resolve(
    import.meta.dirname,
    '../src/content/workshop-router-index.json'
  )
  if ((await readFile(indexPath, 'utf8').catch(() => '')) !== index)
    await writeFile(indexPath, index)
  process.stdout.write(
    `Packed ${countPackedRecords(packed)} authored Router contracts and ${countPackedRecords(index)} catalog entries\n`
  )
}

if (isDirectExecution(process.argv[1], import.meta.filename)) await main()
