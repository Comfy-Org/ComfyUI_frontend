import { describe, expect, it } from 'vitest'

import { PromptExecutionError } from '@/scripts/api'

describe('PromptExecutionError', () => {
  it.for([
    {
      name: 'omits details, as the cloud contract allows',
      reason: {
        type: 'unknown_node_class',
        message: "this deployment's build does not contain SomeCustomNode."
      },
      expected:
        '\nSomeCustomNode:\n    - ' +
        "this deployment's build does not contain SomeCustomNode."
    },
    {
      name: 'sends empty details, as core ComfyUI does',
      reason: {
        type: 'prompt_no_outputs',
        message: 'Prompt has no outputs',
        details: ''
      },
      expected: '\nSomeCustomNode:\n    - Prompt has no outputs'
    },
    {
      name: 'sends details',
      reason: {
        type: 'value_not_in_list',
        message: 'Value not in list',
        details: 'ckpt_name: missing.safetensors'
      },
      expected:
        '\nSomeCustomNode:\n    - Value not in list: ckpt_name: missing.safetensors'
    }
  ])('formats a node error that $name', ({ reason, expected }) => {
    expect(
      new PromptExecutionError({
        error: '',
        node_errors: {
          '12': {
            class_type: 'SomeCustomNode',
            errors: [reason],
            dependent_outputs: []
          }
        }
      }).toString()
    ).toBe(expected)
  })
  it('formats a prompt error without details', () => {
    expect(
      new PromptExecutionError({
        error: {
          type: 'PARTNER_NODE_DISABLED',
          message: 'Partner node disabled'
        }
      }).toString()
    ).toBe('Partner node disabled')
  })
})
