import { describe, expect, it } from 'vitest'

import {
  resolveMissingErrorMessage,
  resolveRunErrorMessage
} from './errorMessageResolver'
import type { NodeValidationError } from './types'
import { i18n } from '@/i18n'

function requiredInputMissing(inputName?: string): NodeValidationError {
  return {
    type: 'required_input_missing',
    message: 'Required input is missing',
    details: inputName ?? '',
    extra_info: inputName
      ? {
          input_name: inputName
        }
      : undefined
  }
}

function runtimeError() {
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
    current_outputs: {}
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

  it('interpolates fallback templates when catalog keys are missing in the active locale', () => {
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
        displayDetails: '0 is missing a required input: seed',
        displayItemLabel: '0 - seed',
        toastMessage: '0 is missing a required input: seed'
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
        error: runtimeError()
      })
    ).toEqual({
      catalogId: 'execution_failed',
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
        error: runtimeError()
      }).toastMessage
    ).toBe(
      'This node threw an error during execution. Check its inputs or try a different configuration.'
    )
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
