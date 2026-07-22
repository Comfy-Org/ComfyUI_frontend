import { describe, expect, it } from 'vitest'

import type { ComfyApiWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

import {
  isPartnerNodePolicyPromptResponse,
  normalizePartnerNodePolicyPromptError
} from './partnerNodePolicyPromptError'

const prompt: ComfyApiWorkflow = {
  '1': {
    class_type: 'KlingImage2VideoNode',
    inputs: {},
    _meta: { title: 'Kling Image to Video' }
  },
  '2': {
    class_type: 'KSampler',
    inputs: {},
    _meta: { title: 'KSampler' }
  }
}

describe('partnerNodePolicyPromptError', () => {
  it('maps authoritative Cloud offenders back to frontend node errors', () => {
    const result = normalizePartnerNodePolicyPromptError(
      {
        error: {
          type: 'PARTNER_NODE_DISABLED',
          message: 'Workspace policy denied KlingImage2VideoNode',
          class_types: ['KlingImage2VideoNode'],
          providers: ['kling']
        }
      },
      prompt
    )

    expect(result?.node_errors).toEqual({
      '1': {
        class_type: 'KlingImage2VideoNode',
        dependent_outputs: [],
        errors: [
          {
            type: 'workspace_partner_node_disabled',
            message: 'This node has been disabled by your team admin.',
            details: '',
            extra_info: {}
          }
        ]
      }
    })
    expect(result && isPartnerNodePolicyPromptResponse(result)).toBe(true)
  })

  it('ignores malformed or unrelated prompt errors', () => {
    expect(
      normalizePartnerNodePolicyPromptError(
        { error: { type: 'PARTNER_NODE_DISABLED' } },
        prompt
      )
    ).toBeNull()
    expect(
      normalizePartnerNodePolicyPromptError(
        {
          error: {
            type: 'OTHER_ERROR',
            class_types: ['KlingImage2VideoNode']
          }
        },
        prompt
      )
    ).toBeNull()
  })
})
