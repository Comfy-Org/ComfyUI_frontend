import { describe, expect, it } from 'vitest'

import { zSharedWorkflowResponse } from '@/platform/workflow/sharing/schemas/shareSchemas'

function makePayload(name: string) {
  return {
    share_id: 'share-1',
    workflow_id: 'wf-1',
    name,
    listed: false,
    publish_time: null,
    workflow_json: {},
    assets: []
  }
}

describe('zSharedWorkflowResponse name sanitization', () => {
  it('strips forward slashes from name', () => {
    const result = zSharedWorkflowResponse.parse(
      makePayload('../../malicious/path')
    )
    expect(result.name).toBe('.._.._malicious_path')
  })

  it('strips backslashes from name', () => {
    const result = zSharedWorkflowResponse.parse(
      makePayload('..\\..\\malicious\\path')
    )
    expect(result.name).toBe('.._.._malicious_path')
  })

  it('strips colons from name', () => {
    const result = zSharedWorkflowResponse.parse(makePayload('C:\\evil'))
    expect(result.name).toBe('C__evil')
  })

  it('truncates names exceeding 200 characters', () => {
    const longName = 'a'.repeat(300)
    const result = zSharedWorkflowResponse.parse(makePayload(longName))
    expect(result.name).toHaveLength(200)
  })

  it('preserves safe names unchanged', () => {
    const result = zSharedWorkflowResponse.parse(
      makePayload('My Cool Workflow (v2)')
    )
    expect(result.name).toBe('My Cool Workflow (v2)')
  })

  it('trims whitespace from sanitized names', () => {
    const result = zSharedWorkflowResponse.parse(makePayload('  spaced name  '))
    expect(result.name).toBe('spaced name')
  })
})
