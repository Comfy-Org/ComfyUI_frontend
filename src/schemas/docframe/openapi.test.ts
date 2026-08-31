import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

type ObjectSchema = {
  properties?: Record<string, ObjectSchema>
  required?: string[]
  type?: string
  items?: ObjectSchema
  minLength?: number
}

const openApi = parse(
  readFileSync(
    join(process.cwd(), 'src/schemas/docframe/openapi.yaml'),
    'utf-8'
  )
) as {
  components: { schemas: Record<string, ObjectSchema> }
}

const docUpdateSchema = openApi.components.schemas.DocUpdateData
const opIdsSchema = docUpdateSchema.properties?.op_ids

const validDocUpdateFixtures = [
  { v: 1, workflow_id: 'wf-1', seq: 1, update_b64: 'AQ==' },
  {
    v: 1,
    workflow_id: 'wf-1',
    seq: 2,
    update_b64: 'AQ==',
    op_ids: ['op-1', 'op-2']
  }
]

const invalidDocUpdateFixtures = [
  { v: 1, workflow_id: 'wf-1', seq: 3, update_b64: 'AQ==', op_ids: [''] },
  { v: 1, workflow_id: 'wf-1', seq: 4, update_b64: 'AQ==', op_ids: [42] }
]

function opIdsMatchesSchema(value: unknown): boolean {
  if (value === undefined) return true
  if (opIdsSchema?.type !== 'array') return false
  if (!Array.isArray(value)) return false

  return value.every(
    (item) =>
      typeof item === opIdsSchema.items?.type &&
      item.length >= (opIdsSchema.items.minLength ?? 0)
  )
}

describe('docframe OpenAPI schema', () => {
  it('keeps doc_update operation ids as optional non-empty strings', () => {
    expect(docUpdateSchema.required).not.toContain('op_ids')
    expect(opIdsSchema).toMatchObject({
      type: 'array',
      items: { type: 'string', minLength: 1 }
    })
    expect(
      validDocUpdateFixtures.every((fixture) =>
        opIdsMatchesSchema(fixture.op_ids)
      )
    ).toBe(true)
    expect(
      invalidDocUpdateFixtures.every(
        (fixture) => !opIdsMatchesSchema(fixture.op_ids)
      )
    ).toBe(true)
  })
})
