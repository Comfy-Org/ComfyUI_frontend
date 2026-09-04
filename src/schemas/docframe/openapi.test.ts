import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Ajv from 'ajv'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

const openApi = parse(
  readFileSync(
    join(process.cwd(), 'src/schemas/docframe/openapi.yaml'),
    'utf-8'
  )
) as {
  components: { schemas: Record<string, unknown> }
}

const validateDocUpdate = new Ajv({ strict: false }).compile({
  $ref: '#/components/schemas/DocUpdateData',
  components: openApi.components
})

const validDocUpdateFixtures = [
  { v: 1, workflow_id: 'wf-1', seq: 1, update_b64: 'AQ==' },
  {
    v: 1,
    workflow_id: 'wf-1',
    seq: 2,
    update_b64: 'AQ==',
    op_ids: ['op-1', 'op-2']
  },
  {
    v: 1,
    workflow_id: 'wf-1',
    seq: 3,
    update_b64: 'AQ==',
    op_ids: Array.from({ length: 256 }, () => 'x'.repeat(128))
  }
]

const invalidDocUpdateFixtures = [
  { workflow_id: 'wf-1', seq: 4, update_b64: 'AQ==' },
  {
    v: 1,
    workflow_id: 'wf-1',
    seq: 5,
    update_b64: 'AQ==',
    unexpected: true
  },
  { v: 1, workflow_id: 'wf-1', seq: 6, update_b64: 'AQ==', op_ids: [''] },
  { v: 1, workflow_id: 'wf-1', seq: 7, update_b64: 'AQ==', op_ids: [42] },
  {
    v: 1,
    workflow_id: 'wf-1',
    seq: 8,
    update_b64: 'AQ==',
    op_ids: Array.from({ length: 257 }, () => 'op')
  },
  {
    v: 1,
    workflow_id: 'wf-1',
    seq: 9,
    update_b64: 'AQ==',
    op_ids: ['x'.repeat(129)]
  }
]

describe('docframe OpenAPI schema', () => {
  it('validates complete doc_update payloads', () => {
    for (const fixture of validDocUpdateFixtures) {
      expect(validateDocUpdate(fixture)).toBe(true)
    }

    for (const fixture of invalidDocUpdateFixtures) {
      expect(validateDocUpdate(fixture)).toBe(false)
      expect(validateDocUpdate.errors).not.toBeNull()
    }
  })
})
