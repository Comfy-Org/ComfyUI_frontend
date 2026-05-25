import { describe, expect, it } from 'vitest'

import {
  resolveMissingErrorMessage,
  resolveRunErrorMessage
} from './errorMessageResolver'
import type { NodeValidationError } from './types'
import { i18n } from '@/i18n'

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
        'Not enough GPU memory. Try reducing complexity and run again.'
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
