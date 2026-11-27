import { describe, expect, it } from 'vitest'

import type { JobDetail } from '@comfyorg/api-client/jobs/jobTypes'

import {
  LOCAL_MCP_USAGE_SOURCE,
  readJobUsageSource
} from '@/platform/localMcp/localMcpConnection'

const detail = (workflow: unknown): JobDetail => ({
  id: 'job-1',
  status: 'completed',
  create_time: 1,
  outputs_count: 0,
  previewable_outputs_count: 0,
  workflow
})

describe('readJobUsageSource', () => {
  it.for([
    {
      case: 'an MCP-submitted job',
      workflow: { extra_data: { comfy_usage_source: LOCAL_MCP_USAGE_SOURCE } },
      expected: LOCAL_MCP_USAGE_SOURCE
    },
    {
      case: 'a frontend job',
      workflow: { extra_data: { comfy_usage_source: 'comfyui-frontend' } },
      expected: 'comfyui-frontend'
    },
    {
      case: 'no attribution',
      workflow: { extra_data: {} },
      expected: undefined
    },
    { case: 'no extra_data', workflow: {}, expected: undefined },
    {
      case: 'a non-string source',
      workflow: { extra_data: { comfy_usage_source: 3 } },
      expected: undefined
    },
    { case: 'a malformed workflow', workflow: 'nope', expected: undefined }
  ])('returns $expected for $case', ({ workflow, expected }) => {
    expect(readJobUsageSource(detail(workflow))).toBe(expected)
  })

  it('returns undefined without a detail', () => {
    expect(readJobUsageSource(undefined)).toBeUndefined()
  })
})
