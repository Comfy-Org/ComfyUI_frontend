import { describe, expect, it } from 'vitest'

import {
  resolveMissingErrorMessage,
  resolveMissingMediaItemLabel,
  resolveRunErrorMessage
} from './errorMessageResolver'
import type { NodeValidationError } from './types'
import type { ExecutionErrorWsMessage } from '@/schemas/apiSchema'
import type { MissingMediaGroup } from '@/platform/missingMedia/types'
import type { MissingModelGroup } from '@/platform/missingModel/types'
import type { MissingNodeType } from '@/types/comfy'
import { i18n, te } from '@/i18n'

function nodeValidationError(
  type: string,
  inputName?: string,
  details = inputName ?? '',
  extraInfo: Record<string, unknown> = {}
): NodeValidationError {
  const extra_info =
    inputName || Object.keys(extraInfo).length > 0
      ? {
          ...(inputName ? { input_name: inputName } : {}),
          ...extraInfo
        }
      : undefined

  return {
    type,
    message: 'Validation failed',
    details,
    extra_info
  }
}

function requiredInputMissing(inputName?: string): NodeValidationError {
  return {
    ...nodeValidationError('required_input_missing', inputName),
    message: 'Required input is missing'
  }
}

function executionError(
  exceptionType: string,
  exceptionMessage: string
): ExecutionErrorWsMessage {
  return {
    prompt_id: 'prompt-1',
    timestamp: Date.now(),
    node_id: '1',
    node_type: 'KSampler',
    executed: [],
    exception_type: exceptionType,
    exception_message: exceptionMessage,
    traceback: [],
    current_inputs: {},
    current_outputs: {}
  }
}

function missingNodeType(
  type: string,
  nodeId: string,
  cnrId?: string
): MissingNodeType {
  return {
    type,
    nodeId,
    cnrId,
    isReplaceable: false
  }
}

function replaceableNodeType(
  type: string,
  nodeId: string,
  replacementNodeType: string
): MissingNodeType {
  return {
    type,
    nodeId,
    isReplaceable: true,
    replacement: {
      old_node_id: type,
      new_node_id: replacementNodeType,
      old_widget_ids: null,
      input_mapping: null,
      output_mapping: null
    }
  }
}

function missingModelGroups(...names: string[]): MissingModelGroup[] {
  return [
    {
      directory: 'checkpoints',
      isAssetSupported: true,
      models: names.map((name) => ({
        name,
        representative: {
          name,
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          directory: 'checkpoints',
          isAssetSupported: true,
          isMissing: true
        },
        referencingNodes: []
      }))
    }
  ]
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

  it('preserves special characters in catalog copy for node names', () => {
    const nodeDisplayName = 'A & B <C>'
    const result = resolveRunErrorMessage({
      kind: 'execution',
      error: executionError('ImageDownloadError', 'Failed to validate images'),
      nodeDisplayName
    })
    const interpolatedCopy = [
      result.displayItemLabel,
      result.toastMessage
    ].join(' ')

    expect(interpolatedCopy).toContain(nodeDisplayName)
    expect(interpolatedCopy).not.toMatch(/&(?:amp|lt|gt);/)
    expect(interpolatedCopy).toContain("couldn't be loaded")
  })

  it('preserves special characters in catalog details copy for node names', () => {
    const nodeDisplayName = 'A & B <C>'
    const result = resolveRunErrorMessage({
      kind: 'node_validation',
      error: requiredInputMissing('model'),
      nodeDisplayName
    })

    expect(result.displayDetails).toContain(nodeDisplayName)
    expect(result.displayDetails).not.toMatch(/&(?:amp|lt|gt);/)
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

  it('resolves unknown validation errors to fallback catalog copy', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError('value_not_valid', undefined, 'some detail'),
        nodeDisplayName: 'KSampler'
      })
    ).toEqual({
      catalogId: 'unknown_validation_error',
      displayTitle: 'Validation failed',
      displayMessage:
        'A node returned a validation error ComfyUI does not recognize.',
      displayDetails:
        'KSampler returned an unrecognized validation error (value_not_valid): some detail',
      displayItemLabel: 'KSampler',
      toastTitle: 'Validation failed',
      toastMessage: 'KSampler returned an unrecognized validation error.'
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
        displayTitle: 'Required input is missing',
        displayMessage: 'Required input is missing',
        displayDetails: 'seed',
        displayItemLabel: '0 - seed',
        toastTitle: 'Required input is missing',
        toastMessage: 'Required input is missing'
      })
    } finally {
      i18n.global.setLocaleMessage('ko', originalKoMessages)
      i18n.global.locale.value = originalLocale
    }
  })

  it.for([
    {
      type: 'bad_linked_input',
      inputName: 'model',
      expected: {
        catalogId: 'bad_linked_input',
        displayTitle: 'Invalid connection',
        displayMessage: 'A node connection could not be read correctly.',
        displayDetails: 'KSampler has an invalid connection for model.',
        displayItemLabel: 'KSampler - model',
        toastTitle: 'Invalid connection',
        toastMessage: 'KSampler has an invalid connection for model.'
      }
    },
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

  it('includes received values in validation range and option details', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'return_type_mismatch',
          'images',
          'images, received_type(LATENT) mismatch input_type(IMAGE)',
          {
            input_config: ['IMAGE', {}],
            received_type: 'LATENT'
          }
        ),
        nodeDisplayName: 'Preview Image'
      })
    ).toMatchObject({
      displayDetails:
        "Preview Image's images input expects IMAGE, but the connected output is LATENT.",
      toastMessage:
        "Preview Image's images input expects IMAGE, but the connected output is LATENT."
    })

    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'invalid_input_type',
          'steps',
          "steps, abc, invalid literal for int() with base 10: 'abc'",
          {
            input_config: ['INT', {}],
            received_value: 'abc'
          }
        ),
        nodeDisplayName: 'KSampler'
      })
    ).toMatchObject({
      displayDetails:
        "The value abc for KSampler's steps couldn't be converted to INT.",
      toastMessage:
        "The value abc for KSampler's steps couldn't be converted to INT."
    })

    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError('value_smaller_than_min', 'steps', 'steps', {
          input_config: ['INT', { min: 1 }],
          received_value: 0
        }),
        nodeDisplayName: 'KSampler'
      })
    ).toMatchObject({
      displayDetails:
        "The value 0 for KSampler's steps is below the minimum 1.",
      toastMessage: "The value 0 for KSampler's steps is below the minimum 1."
    })

    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError('value_bigger_than_max', 'cfg', 'cfg', {
          input_config: ['FLOAT', { max: 30 }],
          received_value: 40
        }),
        nodeDisplayName: 'KSampler'
      })
    ).toMatchObject({
      displayDetails:
        "The value 40 for KSampler's cfg is above the maximum 30.",
      toastMessage: "The value 40 for KSampler's cfg is above the maximum 30."
    })

    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'value_not_in_list',
          'scheduler',
          'scheduler',
          {
            received_value: 'not-a-scheduler'
          }
        ),
        nodeDisplayName: 'KSampler'
      })
    ).toMatchObject({
      displayDetails:
        "The value not-a-scheduler for KSampler's scheduler is not available.",
      toastMessage:
        "The value not-a-scheduler for KSampler's scheduler is not available."
    })
  })

  it('falls back to generic copy when structured values cannot be formatted', () => {
    const circularValue: Record<string, unknown> = {}
    circularValue.self = circularValue

    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'invalid_input_type',
          'steps',
          "steps, [object Object], invalid literal for int() with base 10: 'abc'",
          {
            input_config: ['INT', {}],
            received_value: circularValue
          }
        ),
        nodeDisplayName: 'KSampler'
      })
    ).toMatchObject({
      displayDetails: "KSampler couldn't convert steps to the expected type.",
      toastMessage: "KSampler couldn't convert steps to the expected type."
    })
  })

  it('includes raw details when validation itself fails unexpectedly', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'exception_during_inner_validation',
          'images',
          'list index out of range'
        ),
        nodeDisplayName: 'Image Scale'
      })
    ).toMatchObject({
      displayTitle: 'Validation failed',
      displayMessage: "The workflow couldn't validate a connected node.",
      displayDetails:
        "Image Scale couldn't validate images: list index out of range",
      displayItemLabel: 'Image Scale - images',
      toastTitle: 'Validation failed',
      toastMessage:
        "Image Scale couldn't validate images: list index out of range"
    })

    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'exception_during_validation',
          undefined,
          'tuple index out of range'
        ),
        nodeDisplayName: 'Preview Image'
      })
    ).toMatchObject({
      displayTitle: 'Validation failed',
      displayMessage:
        'The workflow could not be validated because a node validation check failed unexpectedly.',
      displayDetails:
        'Preview Image failed during validation: tuple index out of range',
      displayItemLabel: 'Preview Image',
      toastTitle: 'Validation failed',
      toastMessage:
        'Preview Image failed during validation: tuple index out of range'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'exception_during_validation',
          undefined,
          ''
        ),
        nodeDisplayName: 'Preview Image'
      })
    ).toMatchObject({
      displayDetails: 'Preview Image failed during validation.',
      toastMessage: 'Preview Image failed during validation.'
    })
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

    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'custom_validation_failed',
          'image',
          "[Errno 21] Is a directory: '/app/comfyui/input'"
        ),
        nodeDisplayName: 'Load Image'
      })
    ).toMatchObject({
      catalogId: 'image_not_loaded',
      displayTitle: 'Image not loaded',
      displayMessage: "The system couldn't load this image.",
      displayItemLabel: 'Load Image'
    })
  })

  it('includes raw details for generic custom validation failures', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'custom_validation_failed',
          'setting',
          'setting - Unsupported lab value: bad-value'
        ),
        nodeDisplayName: 'Custom Validation Error'
      })
    ).toMatchObject({
      catalogId: 'custom_validation_failed',
      displayTitle: 'Invalid input',
      displayMessage: 'A node rejected one or more input values.',
      displayDetails:
        'Custom Validation Error failed custom validation: setting - Unsupported lab value: bad-value',
      displayItemLabel: 'Custom Validation Error - setting',
      toastTitle: 'Invalid input',
      toastMessage: 'Custom Validation Error rejected the value for setting.'
    })
  })

  it('does not treat raw details as the input name when input metadata is missing', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'custom_validation_failed',
          undefined,
          'Traceback line 1\nTraceback line 2'
        ),
        nodeDisplayName: 'Custom Validation Error'
      })
    ).toMatchObject({
      displayItemLabel: 'Custom Validation Error - unknown input',
      toastMessage:
        'Custom Validation Error rejected the value for unknown input.'
    })
  })

  it('includes raw cycle paths for dependency cycle details', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'node_validation',
        error: nodeValidationError(
          'dependency_cycle',
          undefined,
          '7 (ImageScale) -> 7 (ImageScale)'
        ),
        nodeDisplayName: 'Image Scale'
      })
    ).toMatchObject({
      displayTitle: 'Invalid workflow',
      displayMessage: 'The workflow has a circular node connection.',
      displayDetails:
        'Image Scale is part of a circular connection: 7 (ImageScale) to 7 (ImageScale)',
      displayItemLabel: 'Image Scale',
      toastTitle: 'Invalid workflow',
      toastMessage: 'Image Scale is part of a circular connection.'
    })
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

  it('resolves the agent draft-apply failure to overlay copy', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: true,
        error: {
          type: 'agent_draft_apply_failed',
          message: "Couldn't apply the agent's draft to the canvas",
          details: 'Validation error: Required at "version"'
        }
      })
    ).toEqual({
      displayTitle: 'An error was found',
      displayMessage: "Couldn't apply the agent's draft to the canvas."
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
        'Not enough GPU memory. Try reducing image resolution or batch size and run again.',
      displayDetails: 'Workflow execution failed'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: false,
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
        'Not enough GPU memory. Try reducing image resolution or batch size and run again.',
      displayDetails: 'Workflow execution failed'
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
      displayMessage: "The system couldn't load this image.",
      displayDetails: 'Failed to validate images'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: true,
        error: {
          type: 'prompt_outputs_failed_validation',
          message: 'Prompt outputs failed validation',
          details: ''
        }
      })
    ).toEqual({
      displayTitle: 'Prompt validation failed',
      displayMessage:
        'The workflow has invalid node inputs. Fix the highlighted nodes before running it again.'
    })
  })

  it('resolves targeted runtime execution errors', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        nodeDisplayName: 'KSampler',
        error: executionError(
          'torch.OutOfMemoryError',
          'Allocation on device 0 failed.\nThis error means you ran out of memory on your GPU.'
        )
      })
    ).toEqual({
      catalogId: 'out_of_memory',
      displayTitle: 'Generation failed',
      displayMessage:
        'Not enough GPU memory. Try reducing image resolution or batch size and run again.',
      displayDetails:
        'Allocation on device 0 failed.\nThis error means you ran out of memory on your GPU.',
      displayItemLabel: 'KSampler',
      toastTitle: 'Generation failed',
      toastMessage:
        'Not enough GPU memory. Try reducing image resolution or batch size and run again.'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        nodeDisplayName: 'Load Image',
        error: executionError('ImageDownloadError', 'Failed to validate images')
      })
    ).toMatchObject({
      catalogId: 'image_not_loaded',
      displayTitle: 'Image not loaded',
      displayMessage: "The system couldn't load this image.",
      displayItemLabel: 'Load Image',
      toastTitle: "Input image couldn't be loaded",
      toastMessage:
        "The image for Load Image couldn't be loaded. Try adding it again."
    })

    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        nodeDisplayName: 'Load Image',
        error: executionError(
          'IsADirectoryError',
          "[Errno 21] Is a directory: '/app/comfyui/input'"
        )
      })
    ).toMatchObject({
      catalogId: 'image_not_loaded',
      displayTitle: 'Image not loaded',
      displayMessage: "The system couldn't load this image.",
      displayItemLabel: 'Load Image'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        nodeDisplayName: 'File Reader',
        error: executionError(
          'RuntimeError',
          "[Errno 21] Is a directory: '/tmp/not-an-input-image'"
        )
      })
    ).toMatchObject({
      catalogId: 'execution_failed',
      displayTitle: 'Execution failed'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        nodeDisplayName: 'CLIP Text Encode',
        error: executionError(
          'RuntimeError',
          'ERROR: clip input is invalid: None\n\nIf the clip is from a checkpoint loader node your checkpoint does not contain a valid clip or text encoder model.'
        )
      })
    ).toMatchObject({
      catalogId: 'invalid_clip_input',
      displayTitle: 'Invalid CLIP input',
      displayMessage:
        'The CLIP input is missing or invalid. Check the connected checkpoint or CLIP loader.',
      displayItemLabel: 'CLIP Text Encode',
      toastMessage: 'CLIP Text Encode has a missing or invalid CLIP input.'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        nodeDisplayName: 'KSampler',
        error: executionError(
          'OOMError',
          'Workflow execution failed due to insufficient memory (OOM). Try reducing image resolution or batch size.'
        )
      })
    ).toMatchObject({
      catalogId: 'out_of_memory',
      displayTitle: 'Generation failed',
      displayMessage:
        'Not enough GPU memory. Try reducing image resolution or batch size and run again.',
      displayItemLabel: 'KSampler'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        nodeDisplayName: 'KSampler',
        error: executionError(
          'RuntimeError',
          'CUDA out of memory. Tried to allocate 6.00 GiB. GPU 0 has 2.00 GiB free.'
        )
      })
    ).toMatchObject({
      catalogId: 'out_of_memory',
      displayTitle: 'Generation failed',
      displayDetails:
        'CUDA out of memory. Tried to allocate 6.00 GiB. GPU 0 has 2.00 GiB free.'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        nodeDisplayName: 'KSampler',
        error: executionError('RuntimeError', 'GPU out of memory')
      })
    ).toMatchObject({
      catalogId: 'out_of_memory',
      displayMessage:
        'Not enough GPU memory. Try reducing image resolution or batch size and run again.',
      displayDetails: 'GPU out of memory'
    })
  })

  it.for([
    {
      type: 'InsufficientFundsError',
      message:
        'Payment Required: Please add credits to your account to use this node.',
      expected: {
        catalogId: 'insufficient_credits',
        displayTitle: 'Insufficient credits',
        displayMessage: 'Add credits to your account to use this node.'
      }
    },
    {
      type: 'InsufficientFundsError',
      message:
        'Payment Required: Please add credits to your workspace to continue.',
      expected: {
        catalogId: 'workspace_insufficient_credits',
        displayTitle: 'Insufficient credits',
        displayMessage: 'Add credits to your workspace to continue.'
      }
    },
    {
      type: 'InactiveSubscriptionError',
      message:
        'User has no active subscription. Please subscribe to a plan to continue.',
      expected: {
        catalogId: 'subscription_required',
        displayTitle: 'Subscription required',
        displayMessage: 'Subscribe to a plan to continue running this workflow.'
      }
    },
    {
      type: 'RuntimeError',
      message:
        'the following private models require a subscription upgrade: Skullgirls_Cerebella.safetensors',
      expected: {
        catalogId: 'subscription_upgrade_required',
        displayTitle: 'Subscription upgrade required',
        displayMessage:
          'Upgrade your subscription to use the private models in this workflow.',
        displayDetails:
          'Private models require a subscription upgrade: Skullgirls_Cerebella.safetensors',
        toastMessage:
          'Upgrade your subscription to use these private models: Skullgirls_Cerebella.safetensors.'
      }
    },
    {
      type: 'RuntimeError',
      message: 'Unauthorized: Please login first to use this node.',
      expected: {
        catalogId: 'sign_in_required',
        displayTitle: 'Sign in required',
        displayMessage:
          'Partner nodes require a Comfy account. Sign in to continue.'
      }
    },
    {
      type: 'RuntimeError',
      message:
        'Rate Limit Exceeded: The server returned 429 after all retry attempts. Please wait and try again.',
      expected: {
        catalogId: 'rate_limited',
        displayTitle: 'Servers are busy',
        displayMessage: 'High demand right now. Try again in a moment.'
      }
    }
  ])(
    'resolves $type runtime execution errors by stable copy',
    ({ type, message, expected }) => {
      expect(
        resolveRunErrorMessage({
          kind: 'execution',
          nodeDisplayName: 'API Node',
          error: executionError(type, message)
        })
      ).toMatchObject({
        ...expected,
        displayItemLabel: 'API Node'
      })
    }
  )

  it.for([
    {
      type: 'ServiceError',
      message: 'ServiceError: Job execution time exceeded maximum limit',
      expected: {
        catalogId: 'timeout',
        displayTitle: 'Generation timed out',
        displayMessage:
          'This workflow reached the maximum run time. Try reducing image resolution, batch size, or workflow length and run again.'
      }
    },
    {
      type: 'ServiceError',
      message: 'ServiceError: Job went too long without making any progress',
      expected: {
        catalogId: 'generation_stalled',
        displayTitle: 'Generation stalled',
        displayMessage:
          'This workflow stopped making progress. Try running it again.'
      }
    },
    {
      type: 'ServiceError',
      message: 'ServiceError: Job has stagnated',
      expected: {
        catalogId: 'generation_stalled',
        displayTitle: 'Generation stalled',
        displayMessage:
          'This workflow stopped making progress. Try running it again.'
      }
    },
    {
      type: 'ServiceError',
      message: 'ServiceError: RIP to the server your workflow was running on.',
      expected: {
        catalogId: 'server_crashed',
        displayTitle: 'Server crashed',
        displayMessage:
          'The server stopped while running this workflow. Try again.'
      }
    },
    {
      type: 'ServiceError',
      message: 'ServiceError: Executor is busy with another job',
      expected: {
        catalogId: 'server_busy',
        displayTitle: 'Servers are busy',
        displayMessage: 'The servers are busy right now. Try again in a moment.'
      }
    },
    {
      type: 'DispatcherError',
      message: 'DispatcherError: Preprocessing timed out',
      expected: {
        catalogId: 'preprocessing_timeout',
        displayTitle: 'Preparation timed out',
        displayMessage:
          'The workflow took too long to prepare. Try running it again.'
      }
    },
    {
      type: 'DispatcherError',
      message: 'DispatcherError: Preprocessing failed',
      expected: {
        catalogId: 'preprocessing_failed',
        displayTitle: 'Preparation failed',
        displayMessage:
          'The workflow could not be prepared. Try running it again.'
      }
    },
    {
      type: 'DispatcherError',
      message: 'DispatcherError: Preprocessing failed: input archive missing',
      expected: {
        catalogId: 'preprocessing_failed',
        displayTitle: 'Preparation failed',
        displayMessage:
          'The workflow could not be prepared. Try running it again.',
        displayDetails: 'Preprocessing failed: input archive missing'
      }
    },
    {
      type: 'AccessRequired',
      message:
        'AccessRequired: This run requires access that is not available for the current account.',
      expected: {
        catalogId: 'access_required',
        displayTitle: 'Access required',
        displayMessage:
          'This run requires access that is not available for the current account.'
      }
    },
    {
      type: 'ModelAccessError',
      message:
        'ModelAccessError: One or more required models could not be accessed.',
      expected: {
        catalogId: 'model_access_error',
        displayTitle: 'Model access required',
        displayMessage: 'One or more required models could not be accessed.'
      }
    },
    {
      type: 'ValidationError',
      message:
        "ValidationError: Field 'prompt' cannot be shorter than 1 characters; was 0 characters long.",
      expected: {
        catalogId: 'invalid_prompt',
        displayTitle: 'Prompt is empty',
        displayMessage: 'Enter a prompt before running this workflow.'
      }
    },
    {
      type: 'ValidationError',
      message: "ValidationError: Field 'prompt' cannot be empty.",
      expected: {
        catalogId: 'invalid_prompt',
        displayTitle: 'Prompt is empty',
        displayMessage: 'Enter a prompt before running this workflow.'
      }
    },
    {
      type: 'ValidationError',
      message: 'ValidationError: The workflow request is invalid.',
      expected: {
        catalogId: 'invalid_workflow_request',
        displayTitle: 'Invalid workflow request',
        displayMessage:
          'The workflow request is invalid. Check the workflow and try again.'
      }
    },
    {
      type: 'ValidationError',
      message: 'ValidationError: Invalid job: missing workflow',
      expected: {
        catalogId: 'invalid_workflow_request',
        displayTitle: 'Invalid workflow request',
        displayMessage:
          'The workflow request is invalid. Check the workflow and try again.'
      }
    },
    {
      type: 'ValidationError',
      message: "ValidationError: Invalid workflow: missing 'prompt' field",
      expected: {
        catalogId: 'invalid_workflow_request',
        displayTitle: 'Invalid workflow request',
        displayMessage:
          'The workflow request is invalid. Check the workflow and try again.'
      }
    },
    {
      type: 'ValidationError',
      message:
        "ValidationError: Invalid workflow: 'prompt' field must be an object",
      expected: {
        catalogId: 'invalid_workflow_request',
        displayTitle: 'Invalid workflow request',
        displayMessage:
          'The workflow request is invalid. Check the workflow and try again.'
      }
    },
    {
      type: 'ModelDownloadError',
      message:
        'ModelDownloadError: the following private models require a subscription upgrade: Skullgirls_Cerebella.safetensors, alex_ahad_style_ponyxl.safetensors',
      expected: {
        catalogId: 'subscription_upgrade_required',
        displayTitle: 'Subscription upgrade required',
        displayDetails:
          'Private models require a subscription upgrade: Skullgirls_Cerebella.safetensors, alex_ahad_style_ponyxl.safetensors'
      }
    },
    {
      type: 'PanicError',
      message:
        'PanicError: internal error during model download: runtime error: invalid memory address',
      expected: {
        catalogId: 'model_download_failed',
        displayTitle: 'Model download failed',
        displayMessage: 'A model could not be downloaded. Try again.'
      }
    },
    {
      type: 'PanicError',
      message: 'PanicError: internal error during model download: boom',
      expected: {
        catalogId: 'model_download_failed',
        displayTitle: 'Model download failed',
        displayMessage: 'A model could not be downloaded. Try again.'
      }
    },
    {
      type: 'PanicError',
      message: 'PanicError: panic during job execution: boom',
      expected: {
        catalogId: 'run_ended_unexpectedly',
        displayTitle: 'Run ended unexpectedly',
        displayMessage: 'The run ended unexpectedly. Try again.'
      }
    },
    {
      type: 'UnexpectedServiceError',
      message: 'UnexpectedServiceError: Unexpected service error.',
      expected: {
        catalogId: 'unexpected_service_error',
        displayTitle: 'Service error',
        displayMessage:
          'The service encountered an unexpected error. Try again.'
      }
    },
    {
      type: 'RequestError',
      message:
        'RequestError: The request failed before the run could complete.',
      expected: {
        catalogId: 'request_failed',
        displayTitle: 'Request failed',
        displayMessage:
          'The request failed before the run could complete. Try again.'
      }
    },
    {
      type: 'PreprocessingTimeout',
      message: 'PreprocessingTimeout: Preprocessing timed out.',
      expected: {
        catalogId: 'preprocessing_timeout',
        displayTitle: 'Preparation timed out',
        displayMessage:
          'The workflow took too long to prepare. Try running it again.'
      }
    },
    {
      type: 'ServiceError',
      message: 'ServiceError: The run could not be started.',
      expected: {
        catalogId: 'run_start_failed',
        displayTitle: 'Run could not start',
        displayMessage: 'The run could not be started. Try again.'
      }
    },
    {
      type: 'WebSocketError',
      message: 'WebSocketError: Failed to start WebSocket client: EOF',
      expected: {
        catalogId: 'run_start_failed',
        displayTitle: 'Run could not start',
        displayMessage: 'The run could not be started. Try again.',
        displayDetails: 'Failed to start WebSocket client: EOF'
      }
    },
    {
      type: 'ServiceError',
      message:
        'ServiceError: Failed to send prompt request: connection refused',
      expected: {
        catalogId: 'request_failed',
        displayTitle: 'Request failed',
        displayMessage:
          'The request failed before the run could complete. Try again.',
        displayDetails: 'Failed to send prompt request: connection refused'
      }
    },
    {
      type: 'ServiceError',
      message:
        'ServiceError: Failed to complete preparation: transition failed',
      expected: {
        catalogId: 'preprocessing_failed',
        displayTitle: 'Preparation failed',
        displayMessage:
          'The workflow could not be prepared. Try running it again.',
        displayDetails: 'Failed to complete preparation: transition failed'
      }
    },
    {
      type: 'ServiceError',
      message: 'ServiceError: The run ended unexpectedly.',
      expected: {
        catalogId: 'run_ended_unexpectedly',
        displayTitle: 'Run ended unexpectedly',
        displayMessage: 'The run ended unexpectedly. Try again.'
      }
    },
    {
      type: 'Exception',
      message: 'Exception: Servers are busy. Please try again later.',
      expected: {
        catalogId: 'server_busy',
        displayTitle: 'Servers are busy',
        displayMessage: 'The servers are busy right now. Try again in a moment.'
      }
    },
    {
      type: 'WebSocketError',
      message:
        'WebSocketError: Polling aborted due to error: API Error: {"code":"Client specified an invalid argument","error":"Generated video rejected by content moderation."}',
      expected: {
        catalogId: 'content_blocked',
        displayTitle: 'Content blocked',
        displayMessage:
          'This request was blocked by the content moderation system. Try changing the prompt or inputs.'
      }
    },
    {
      type: 'Exception',
      message: 'Exception: Generated video rejected by content moderation.',
      expected: {
        catalogId: 'content_blocked',
        displayTitle: 'Content blocked',
        displayMessage:
          'This request was blocked by the content moderation system. Try changing the prompt or inputs.'
      }
    },
    {
      type: 'Exception',
      message: 'Exception: Prompt or Initial Image failed the safety checks.',
      expected: {
        catalogId: 'content_blocked',
        displayTitle: 'Content blocked',
        displayMessage:
          'This request was blocked by the content moderation system. Try changing the prompt or inputs.'
      }
    },
    {
      type: 'ValueError',
      message:
        'ValueError: The generated image was flagged for content policy violation.',
      expected: {
        catalogId: 'content_blocked',
        displayTitle: 'Content blocked',
        displayMessage:
          'This request was blocked by the content moderation system. Try changing the prompt or inputs.'
      }
    },
    {
      type: 'Exception',
      message:
        "Exception: Content filtered by Google's Responsible AI practices: safety (1 video filtered.)",
      expected: {
        catalogId: 'content_blocked',
        displayTitle: 'Content blocked',
        displayMessage:
          'This request was blocked by the content moderation system. Try changing the prompt or inputs.'
      }
    },
    {
      type: 'Exception',
      message:
        "Exception: Content blocked by Google's Responsible AI filters (1 video filtered).",
      expected: {
        catalogId: 'content_blocked',
        displayTitle: 'Content blocked',
        displayMessage:
          'This request was blocked by the content moderation system. Try changing the prompt or inputs.'
      }
    },
    {
      type: 'Exception',
      message: 'Exception: Generated content was rejected by a safety check.',
      expected: {
        catalogId: 'content_blocked',
        displayTitle: 'Content blocked',
        displayMessage:
          'This request was blocked by the content moderation system. Try changing the prompt or inputs.'
      }
    }
  ])(
    'resolves non-node-scoped runtime failures',
    ({ type, message, expected }) => {
      expect(
        resolveRunErrorMessage({
          kind: 'prompt',
          isCloud: true,
          error: {
            type,
            message,
            details: ''
          }
        })
      ).toMatchObject(expected)
    }
  )

  it('resolves timeout copy without credit copy', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        nodeDisplayName: 'KSampler',
        error: executionError(
          'ServiceError',
          'Job execution time exceeded maximum limit'
        )
      })
    ).toMatchObject({
      catalogId: 'timeout',
      displayMessage:
        'This workflow reached the maximum run time. Try reducing image resolution, batch size, or workflow length and run again.',
      toastMessage:
        'This workflow reached the maximum run time. Try reducing image resolution, batch size, or workflow length and run again.'
    })
  })

  it('does not over-match runtime error lookalikes', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: true,
        error: {
          type: 'RequestError',
          message:
            'RequestError: Failed to send prompt request: request returned error status 400: {"error":{"type":"prompt_outputs_failed_validation"}}',
          details: ''
        }
      })
    ).toEqual({})

    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: true,
        error: {
          type: 'RequestError',
          message:
            'RequestError: Failed to send prompt request: renderer template {node}',
          details: ''
        }
      })
    ).toMatchObject({
      catalogId: 'request_failed',
      displayTitle: 'Request failed',
      displayDetails: 'Failed to send prompt request: renderer template {node}'
    })

    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: true,
        error: {
          type: 'Exception',
          message:
            'Exception: Debug output mentioned the content moderation system, but no content was blocked.',
          details: ''
        }
      })
    ).toEqual({})

    expect(
      resolveRunErrorMessage({
        kind: 'prompt',
        isCloud: true,
        error: {
          type: 'ModelDownloadError',
          message:
            'ModelDownloadError: the following private models require a subscription upgrade:',
          details: ''
        }
      })
    ).toEqual({})
  })

  it('resolves unknown node execution errors to the general runtime fallback', () => {
    expect(
      resolveRunErrorMessage({
        kind: 'execution',
        nodeDisplayName: 'KSampler',
        error: executionError(
          'RuntimeError',
          'mat1 and mat2 shapes cannot be multiplied'
        )
      })
    ).toEqual({
      catalogId: 'execution_failed',
      displayTitle: 'Execution failed',
      displayMessage: 'Node threw an error during execution.',
      displayItemLabel: 'KSampler',
      toastTitle: 'KSampler failed',
      toastMessage:
        'This node threw an error during execution. Check its inputs or try a different configuration.'
    })
  })

  it('resolves missing error group display copy', () => {
    const missingNodeTypes = [missingNodeType('FooNode', '7', 'foo-pack')]
    expect(
      resolveMissingErrorMessage({
        kind: 'missing_node',
        nodeTypes: missingNodeTypes,
        count: 1,
        isCloud: false
      })
    ).toEqual({
      catalogId: 'missing_node',
      displayTitle: 'Missing Node Packs',
      displayMessage: 'Install missing packs to use this workflow.',
      toastTitle: 'Missing node: FooNode',
      toastMessage:
        "This workflow uses a custom node that isn't installed. Install it from the registry or replace the node."
    })

    expect(
      resolveMissingErrorMessage({
        kind: 'missing_node',
        nodeTypes: missingNodeTypes,
        count: 1,
        isCloud: true
      })
    ).toEqual({
      catalogId: 'missing_node',
      displayTitle: 'Unsupported Node Packs',
      displayMessage:
        "Required custom nodes aren't supported on Cloud. Replace them with supported nodes.",
      toastTitle: "FooNode isn't available on Cloud",
      toastMessage: "This node isn't supported on Cloud."
    })

    const multipleMissingNodeTypes = [
      missingNodeType('FooNode', '7', 'foo-pack'),
      missingNodeType('BarNode', '9', 'bar-pack')
    ]
    expect(
      resolveMissingErrorMessage({
        kind: 'missing_node',
        nodeTypes: multipleMissingNodeTypes,
        count: 2,
        isCloud: false
      })
    ).toMatchObject({
      toastTitle: 'Missing nodes',
      toastMessage: '2 nodes require missing node packs.'
    })

    expect(
      resolveMissingErrorMessage({
        kind: 'missing_node',
        nodeTypes: multipleMissingNodeTypes,
        count: 2,
        isCloud: true
      })
    ).toMatchObject({
      toastTitle: "Nodes aren't available on Cloud",
      toastMessage: "This workflow uses nodes that aren't supported on Cloud."
    })

    expect(
      resolveMissingErrorMessage({
        kind: 'missing_node',
        nodeTypes: [
          missingNodeType('FooNode', '7', 'foo-pack'),
          missingNodeType('FooNode', '8', 'foo-pack')
        ],
        count: 1,
        isCloud: false
      })
    ).toMatchObject({
      toastTitle: 'Missing node: FooNode',
      toastMessage:
        "This workflow uses a custom node that isn't installed. Install it from the registry or replace the node."
    })

    const swapNodeTypes = [replaceableNodeType('OldNode', '8', 'NewNode')]
    expect(
      resolveMissingErrorMessage({
        kind: 'swap_nodes',
        nodeTypes: swapNodeTypes,
        count: 1,
        isCloud: false
      })
    ).toEqual({
      catalogId: 'swap_nodes',
      displayTitle: 'Swap Nodes',
      displayMessage: 'Some nodes can be replaced with alternatives',
      toastTitle: 'OldNode can be replaced',
      toastMessage: 'Replace it with NewNode from the error panel.'
    })

    const multipleSwapNodeTypes = [
      replaceableNodeType('OldNodeA', '8', 'NewNodeA'),
      replaceableNodeType('OldNodeB', '9', 'NewNodeB')
    ]
    expect(
      resolveMissingErrorMessage({
        kind: 'swap_nodes',
        nodeTypes: multipleSwapNodeTypes,
        count: 2,
        isCloud: false
      })
    ).toMatchObject({
      displayMessage: 'Some nodes can be replaced with alternatives',
      toastTitle: 'Nodes can be replaced',
      toastMessage: '2 node types can be replaced with compatible alternatives.'
    })

    expect(
      resolveMissingErrorMessage({
        kind: 'swap_nodes',
        nodeTypes: [
          replaceableNodeType('OldNode', '8', 'NewNode'),
          replaceableNodeType('OldNode', '9', 'NewNode')
        ],
        count: 1,
        isCloud: false
      })
    ).toMatchObject({
      toastTitle: 'OldNode can be replaced',
      toastMessage: 'Replace it with NewNode from the error panel.'
    })

    const groups = missingModelGroups('sdxl.safetensors')

    expect(
      resolveMissingErrorMessage({
        kind: 'missing_model',
        groups,
        count: 1,
        isCloud: false
      })
    ).toEqual({
      catalogId: 'missing_model',
      displayTitle: 'Missing Models',
      displayMessage: 'Download a model, or open the node to replace it.',
      toastTitle: 'sdxl.safetensors is missing',
      toastMessage: 'Checkpoint Loader Simple is missing a required model file.'
    })

    expect(
      resolveMissingErrorMessage({
        kind: 'missing_model',
        groups,
        count: 1,
        isCloud: true
      })
    ).toEqual({
      catalogId: 'missing_model',
      displayTitle: 'Missing Models',
      displayMessage: 'Import a model, or open the node to replace it.',
      toastTitle: "sdxl.safetensors isn't available on Cloud",
      toastMessage: "This model isn't supported. Choose a different one."
    })
  })

  it('preserves special characters in catalog copy for model names', () => {
    const modelName = 'sd&xl<v2>.safetensors'
    expect(
      te('errorCatalog.missingErrors.missing_model.toastTitleOneOss')
    ).toBe(true)
    const result = resolveMissingErrorMessage({
      kind: 'missing_model',
      groups: missingModelGroups(modelName),
      count: 1,
      isCloud: false
    })

    expect(result.toastTitle).toContain(modelName)
    expect(result.toastTitle).not.toMatch(/&(?:amp|lt|gt);/)
  })

  it('resolves missing media group display and toast copy', () => {
    const groups: MissingMediaGroup[] = [
      {
        mediaType: 'image',
        items: [
          {
            name: 'portrait.png',
            mediaType: 'image',
            representative: {
              nodeId: '4',
              nodeType: 'LoadImage',
              widgetName: 'image',
              mediaType: 'image',
              name: 'portrait.png',
              isMissing: true
            },
            referencingNodes: [{ nodeId: '4', widgetName: 'image' }]
          }
        ]
      }
    ]

    expect(
      resolveMissingErrorMessage({
        kind: 'missing_media',
        groups,
        count: 1,
        isCloud: false
      })
    ).toEqual({
      catalogId: 'missing_media',
      displayTitle: 'Missing Inputs',
      displayMessage: 'A required media input has no file selected.',
      toastTitle: 'Media input missing',
      toastMessage: 'Load Image is missing a required media file.'
    })
  })

  it.for([
    {
      source: { nodeType: 'LoadImage', widgetName: 'image' },
      displayItemLabel: 'Load Image - image'
    },
    {
      source: {
        nodeDisplayName: 'Custom Loader',
        nodeType: 'LoadImage',
        widgetName: 'image'
      },
      displayItemLabel: 'Custom Loader - image'
    },
    {
      source: { nodeType: '', widgetName: '' },
      displayItemLabel: 'This node - unknown input'
    }
  ] as const)(
    'resolves missing media item labels from $source',
    ({ source, displayItemLabel }) => {
      expect(resolveMissingMediaItemLabel(source)).toEqual({
        displayItemLabel
      })
    }
  )

  it.for([
    [
      'image',
      'LoadImage',
      'image',
      'portrait.png',
      'Media input missing',
      'Load Image is missing a required media file.'
    ],
    [
      'video',
      'LoadVideo',
      'file',
      'clip.mp4',
      'Media input missing',
      'Load Video is missing a required media file.'
    ],
    [
      'audio',
      'LoadAudio',
      'audio',
      'voice.wav',
      'Media input missing',
      'Load Audio is missing a required media file.'
    ]
  ] as const)(
    'resolves missing %s toast copy from media type and node type',
    ([
      mediaType,
      nodeType,
      widgetName,
      mediaName,
      toastTitle,
      toastMessage
    ]) => {
      const groups: MissingMediaGroup[] = [
        {
          mediaType,
          items: [
            {
              name: mediaName,
              mediaType,
              representative: {
                nodeId: '4',
                nodeType,
                widgetName,
                mediaType,
                name: mediaName,
                isMissing: true
              },
              referencingNodes: [{ nodeId: '4', widgetName }]
            }
          ]
        }
      ]

      expect(
        resolveMissingErrorMessage({
          kind: 'missing_media',
          groups,
          count: 1,
          isCloud: false
        })
      ).toMatchObject({
        toastTitle,
        toastMessage
      })
    }
  )

  it('summarizes a shared missing media file by affected node references', () => {
    expect(
      resolveMissingErrorMessage({
        kind: 'missing_media',
        groups: [
          {
            mediaType: 'image',
            items: [
              {
                name: 'shared.png',
                mediaType: 'image',
                representative: {
                  nodeId: '1',
                  nodeType: 'LoadImage',
                  widgetName: 'image',
                  mediaType: 'image',
                  name: 'shared.png',
                  isMissing: true
                },
                referencingNodes: [
                  { nodeId: '1', widgetName: 'image' },
                  { nodeId: '2', widgetName: 'image' }
                ]
              }
            ]
          }
        ],
        count: 2,
        isCloud: false
      })
    ).toMatchObject({
      displayTitle: 'Missing Inputs',
      toastTitle: 'Missing media inputs',
      toastMessage:
        'Please select the missing media inputs before running this workflow.'
    })
  })

  it('summarizes multiple missing model and media items', () => {
    const modelGroups = missingModelGroups('a.safetensors', 'b.safetensors')

    expect(
      resolveMissingErrorMessage({
        kind: 'missing_model',
        groups: modelGroups,
        count: 2,
        isCloud: false
      })
    ).toMatchObject({
      toastTitle: 'Missing models',
      toastMessage: '2 model files are missing.'
    })

    expect(
      resolveMissingErrorMessage({
        kind: 'missing_model',
        groups: modelGroups,
        count: 2,
        isCloud: true
      })
    ).toMatchObject({
      toastTitle: "Models aren't available on Cloud",
      toastMessage: "Some models aren't supported. Choose different ones."
    })

    expect(
      resolveMissingErrorMessage({
        kind: 'missing_media',
        groups: [
          {
            mediaType: 'image',
            items: [
              {
                name: 'a.png',
                mediaType: 'image',
                representative: {
                  nodeId: '1',
                  nodeType: 'LoadImage',
                  widgetName: 'image',
                  mediaType: 'image',
                  name: 'a.png',
                  isMissing: true
                },
                referencingNodes: [{ nodeId: '1', widgetName: 'image' }]
              },
              {
                name: 'b.png',
                mediaType: 'image',
                representative: {
                  nodeId: '2',
                  nodeType: 'LoadImage',
                  widgetName: 'image',
                  mediaType: 'image',
                  name: 'b.png',
                  isMissing: true
                },
                referencingNodes: [{ nodeId: '2', widgetName: 'image' }]
              }
            ]
          }
        ],
        count: 2,
        isCloud: false
      })
    ).toMatchObject({
      toastTitle: 'Missing media inputs',
      toastMessage:
        'Please select the missing media inputs before running this workflow.'
    })
  })
})
