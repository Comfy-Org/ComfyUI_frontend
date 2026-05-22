import { describe, expect, it } from 'vitest'

import {
  resolveMissingErrorMessage,
  resolveRunErrorMessage
} from './errorMessageResolver'
import type { NodeValidationError } from './types'
import type { ExecutionErrorWsMessage } from '@/schemas/apiSchema'
import { i18n } from '@/i18n'

function nodeValidationError(
  type: string,
  inputName?: string,
  details = inputName ?? ''
): NodeValidationError {
  return {
    type,
    message: 'Validation failed',
    details,
    extra_info: inputName
      ? {
          input_name: inputName
        }
      : undefined
  }
}

function requiredInputMissing(inputName?: string): NodeValidationError {
  return {
    ...nodeValidationError('required_input_missing', inputName),
    message: 'Required input is missing'
  }
}

function runtimeError(
  overrides: Partial<ExecutionErrorWsMessage> = {}
): ExecutionErrorWsMessage {
  return {
    prompt_id: 'test',
    timestamp: Date.now(),
    node_id: 1,
    node_type: 'KSampler',
    executed: [],
    exception_type: 'RuntimeError',
    exception_message: 'CUDA out of memory',
    traceback: [],
    current_inputs: {},
    current_outputs: {},
    ...overrides
  }
}

describe('errorMessageResolver', () => {
  it('resolves required_input_missing to missing connection display copy', () => {
    const result = resolveRunErrorMessage({
      kind: 'node_validation',
      error: requiredInputMissing('model'),
      nodeDisplayName: 'KSampler'
    })

    expect(result).toEqual({
      catalogId: 'missing_connection',
      displayTitle: 'Missing connection',
      displayMessage: 'Required input slots have no connection feeding them.',
      displayDetails: 'KSampler is missing a required input: model',
      displayItemLabel: 'KSampler - model',
      toastTitle: 'Required input missing',
      toastMessage: 'KSampler is missing a required input: model'
    })
  })

  it('uses catalog fallbacks when required_input_missing lacks node or input labels', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: requiredInputMissing(),
        nodeDisplayName: ''
      })
    ).toMatchObject({
      displayDetails: 'This node is missing a required input: unknown input',
      displayItemLabel: 'This node - unknown input',
      toastMessage: 'This node is missing a required input: unknown input'
    })
  })

  it('falls back to raw API copy when catalog keys are missing in the active locale', () => {
    const originalLocale = i18n.global.locale.value
    const originalKoMessages = i18n.global.getLocaleMessage('ko')

    i18n.global.setLocaleMessage('ko', {} as typeof originalKoMessages)
    i18n.global.locale.value = 'ko'

    try {
      expect(
        resolveRunErrorMessage({
          kind: 'node_validation',
          error: requiredInputMissing('seed'),
          nodeDisplayName: '0'
        })
      ).toMatchObject({
        displayTitle: 'required_input_missing',
        displayMessage: 'Required input is missing',
        displayDetails: 'seed',
        displayItemLabel: '0 - seed',
        toastTitle: 'required_input_missing',
        toastMessage: 'Required input is missing'
      })
    } finally {
      i18n.global.setLocaleMessage('ko', originalKoMessages)
      i18n.global.locale.value = originalLocale
    }
  })

  it('resolves runtime errors with item labels and toast copy', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        isCloud: true,
        nodeDisplayName: 'KSampler',
        error: runtimeError({
          exception_message: 'mat1 and mat2 shapes cannot be multiplied'
        })
      })
    ).toEqual({
      catalogId: 'execution_failed',
      displayTitle: 'Execution failed',
      displayMessage:
        'Node threw an error during execution. No credits charged.',
      displayItemLabel: 'KSampler',
      toastTitle: 'KSampler failed',
      toastMessage:
        'This node threw an error during execution. Check its inputs or try a different configuration. No credits charged.'
    })
  })

  it('resolves local runtime errors without cloud credit copy', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        isCloud: false,
        nodeDisplayName: 'KSampler',
        error: runtimeError({
          exception_message: 'mat1 and mat2 shapes cannot be multiplied'
        })
      }).toastMessage
    ).toBe(
      'This node threw an error during execution. Check its inputs or try a different configuration.'
    )
  })

  it.for([
    {
      type: 'value_not_in_list',
      inputName: 'scheduler',
      expected: {
        catalogId: 'value_not_in_list',
        displayTitle: 'Invalid input',
        displayMessage: 'Some input values are not available for this node.',
        displayDetails: 'KSampler has an unsupported value for scheduler.',
        displayItemLabel: 'KSampler - scheduler',
        toastTitle: 'Invalid input',
        toastMessage: 'KSampler has an unsupported value for scheduler.'
      }
    },
    {
      type: 'value_smaller_than_min',
      inputName: 'steps',
      expected: {
        catalogId: 'value_smaller_than_min',
        displayTitle: 'Input out of range',
        displayMessage: 'Some input values are outside the allowed range.',
        displayDetails: 'KSampler has a value below the minimum for steps.',
        displayItemLabel: 'KSampler - steps',
        toastTitle: 'Input out of range',
        toastMessage: 'KSampler has a value below the minimum for steps.'
      }
    },
    {
      type: 'return_type_mismatch',
      inputName: 'model',
      expected: {
        catalogId: 'return_type_mismatch',
        displayTitle: 'Invalid connection',
        displayMessage:
          'Connected nodes are using incompatible input and output types.',
        displayDetails: 'KSampler has an incompatible connection for model.',
        displayItemLabel: 'KSampler - model',
        toastTitle: 'Invalid connection',
        toastMessage: 'KSampler has an incompatible connection for model.'
      }
    }
  ])('resolves $type validation errors', ({ type, inputName, expected }) => {
    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(type, inputName),
        nodeDisplayName: 'KSampler'
      })
    ).toEqual(expected)
  })

  it('resolves custom validation image failures as image-not-loaded copy', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'custom_validation_failed',
          'image',
          'image - Invalid image file: broken.png'
        ),
        nodeDisplayName: 'Load Image'
      })
    ).toMatchObject({
      catalogId: 'image_not_loaded',
      displayTitle: 'Image not loaded',
      displayMessage: "The system couldn't load this image.",
      displayDetails:
        "The image for Load Image couldn't be loaded. Try adding it again.",
      displayItemLabel: 'Load Image',
      toastTitle: "Input image couldn't be loaded"
    })
  })

  it('resolves runtime image load failures by exception type or high-confidence message', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        isCloud: true,
        nodeDisplayName: 'Load Image',
        error: runtimeError({
          exception_type: 'ImageDownloadError',
          exception_message: 'Failed to validate images'
        })
      })
    ).toMatchObject({
      catalogId: 'image_not_loaded',
      displayTitle: 'Image not loaded',
      displayMessage: "The system couldn't load this image.",
      displayItemLabel: 'Load Image',
      toastMessage:
        "The image for Load Image couldn't be loaded. Try adding it again."
    })

    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        isCloud: true,
        nodeDisplayName: 'Load Image',
        error: runtimeError({
          exception_message: "[Errno 21] Is a directory: '/app/comfyui/input'"
        })
      }).catalogId
    ).toBe('image_not_loaded')
  })

  it('resolves runtime OOM failures from cloud type and local message patterns', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        isCloud: true,
        nodeDisplayName: 'KSampler',
        error: runtimeError({
          exception_type: 'OOMError',
          exception_message:
            'Workflow execution failed due to insufficient memory (OOM).'
        })
      })
    ).toMatchObject({
      catalogId: 'out_of_memory',
      displayTitle: 'Generation failed',
      displayMessage:
        'Not enough GPU memory. Try reducing complexity and run again. No credits charged.',
      displayItemLabel: 'KSampler',
      toastTitle: 'Generation failed'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        isCloud: false,
        nodeDisplayName: 'KSampler',
        error: runtimeError({
          exception_message: 'torch.cuda.OutOfMemoryError: CUDA out of memory'
        })
      }).displayMessage
    ).toBe('Not enough GPU memory. Try reducing complexity and run again.')
  })

  it('resolves known prompt errors with run error rules', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: false,
        error: {
          type: 'prompt_no_outputs',
          message: 'Prompt has no outputs',
          details: ''
        }
      })
    ).toEqual({
      displayTitle: 'Prompt has no outputs',
      displayMessage:
        'The workflow does not contain any output nodes (e.g. Save Image, Preview Image) to produce a result.'
    })
  })

  it('resolves server_error prompt copy by environment', () => {
    const error = {
      type: 'server_error',
      message: 'Server exploded',
      details: ''
    }

    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: false,
        error
      }).displayMessage
    ).toBe(
      'The server encountered an unexpected error. Please check the server logs.'
    )

    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: true,
        error
      }).displayMessage
    ).toBe(
      'The server encountered an unexpected error. Please try again later.'
    )
  })

  it('leaves unknown prompt errors unresolved', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: false,
        error: {
          type: 'custom_error',
          message: 'Custom prompt failure',
          details: ''
        }
      })
    ).toEqual({})
  })

  it('resolves newly cataloged prompt-level errors', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: true,
        error: {
          type: 'missing_node_type',
          message:
            "Node 'ID #4' has no class_type. The workflow may be corrupted or a custom node is missing.",
          details: "Node ID '#4'"
        }
      })
    ).toEqual({
      displayTitle: 'Missing node type',
      displayMessage:
        'A node type is missing or unavailable. The workflow may be corrupted or require a custom node.'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: true,
        error: {
          type: 'OOMError',
          message: 'OOMError: Workflow execution failed',
          details: ''
        }
      })
    ).toEqual({
      catalogId: 'out_of_memory',
      displayTitle: 'Generation failed',
      displayMessage:
        'Not enough GPU memory. Try reducing complexity and run again. No credits charged.'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: true,
        error: {
          type: 'ImageDownloadError',
          message: 'ImageDownloadError: Failed to validate images',
          details: ''
        }
      })
    ).toEqual({
      catalogId: 'image_not_loaded',
      displayTitle: 'Image not loaded',
      displayMessage: "The system couldn't load this image."
    })
  })

  it('resolves missing error group display copy', () => {
    expect(
      resolveMissingErrorMessage({
        kind: 'missing_model',
        groups: [],
        count: 1,
        isCloud: false
      })
    ).toEqual({
      catalogId: 'missing_model',
      displayTitle: 'Missing Models (1)',
      displayMessage: '1 required model is missing'
    })
  })
})
