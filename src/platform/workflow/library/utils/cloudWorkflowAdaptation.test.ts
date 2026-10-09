import { webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { zTestWorkflowImportMetadata } from '@comfyorg/ingest-types/test-workflows/zod'

import metadata from '@/platform/community/fixtures/cloud-reference-v1/import.json'
import original from '@/platform/community/fixtures/cloud-reference-v1/workflow.json?raw'
import adapted from '@/platform/community/fixtures/cloud-reference-v1/workflow.cloud.json?raw'
import {
  getCloudAdaptation,
  verifyCloudWorkflow,
  workflowDigest
} from './cloudWorkflowAdaptation'

const record = {
  summary: {
    workflow_sha256: metadata.workflow_sha256,
    metadata_sha256: '',
    name: metadata.name,
    description: metadata.description,
    tags: [],
    tasks: [],
    structural_cluster: '',
    node_count: 1,
    unresolved_pack_count: 1,
    verified: false
  },
  metadata: zTestWorkflowImportMetadata.parse(metadata)
}
beforeEach(() => vi.stubGlobal('crypto', webcrypto))

describe('Cloud reference adaptation v1', () => {
  it('validates the producer fixture with separate byte hashes and an exact change ledger', async () => {
    expect(await verifyCloudWorkflow(record, original, adapted)).toBe(true)
    expect(await workflowDigest(original)).toBe(metadata.workflow_sha256)
    expect(record.metadata.cloud_adaptation).toEqual(metadata.cloud_adaptation)
    expect(record.summary.verified).toBe(false)
  })

  it('refuses substituted bytes or an adaptation bound to another original', async () => {
    expect(await verifyCloudWorkflow(record, original, adapted + ' ')).toBe(
      false
    )
    expect(await verifyCloudWorkflow(record, original + ' ', adapted)).toBe(
      false
    )
    const stale = {
      ...record,
      metadata: {
        ...record.metadata,
        cloud_adaptation: {
          ...metadata.cloud_adaptation,
          original_sha256: 'a'.repeat(64)
        }
      }
    }
    expect(getCloudAdaptation(stale)).toBeUndefined()
  })

  it('rejects unrecorded changes even when the adapted digest is updated', async () => {
    const extra = adapted.replace('SyntheticUnknownModelNode', 'DifferentNode')
    const tampered = {
      ...record,
      metadata: {
        ...record.metadata,
        cloud_adaptation: {
          ...metadata.cloud_adaptation,
          workflow_sha256: await workflowDigest(extra)
        }
      }
    }
    expect(await verifyCloudWorkflow(tampered, original, extra)).toBe(false)
  })

  it('detects numeric changes that JavaScript would otherwise round to the same number', async () => {
    const preciseOriginal = original.replace(
      '"id": 1',
      '"id": 9007199254740992'
    )
    const preciseAdapted = adapted.replace('"id":1', '"id":9007199254740993')
    const precise = {
      ...record,
      summary: {
        ...record.summary,
        workflow_sha256: await workflowDigest(preciseOriginal)
      },
      metadata: {
        ...record.metadata,
        workflow_sha256: await workflowDigest(preciseOriginal),
        cloud_adaptation: {
          ...metadata.cloud_adaptation,
          original_sha256: await workflowDigest(preciseOriginal),
          workflow_sha256: await workflowDigest(preciseAdapted)
        }
      }
    }
    expect(
      await verifyCloudWorkflow(precise, preciseOriginal, preciseAdapted)
    ).toBe(false)
  })

  it.for(['wrong-original', 'duplicate', 'missing-pointer'])(
    'rejects an invalid change ledger: %s',
    async (problem) => {
      const change = metadata.cloud_adaptation.changes[0]
      const changes =
        problem === 'duplicate'
          ? [change, change]
          : [
              {
                ...change,
                ...(problem === 'wrong-original'
                  ? { original: 'wrong' }
                  : { location: '/nodes/7/model' })
              }
            ]
      const invalid = {
        ...record,
        metadata: {
          ...record.metadata,
          cloud_adaptation: {
            ...metadata.cloud_adaptation,
            changes
          }
        }
      }
      expect(await verifyCloudWorkflow(invalid, original, adapted)).toBe(false)
    }
  )
})
