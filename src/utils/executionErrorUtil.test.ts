import { describe, expect, it } from 'vitest'

import { zJobDetail } from '@comfyorg/api-client/jobTypes'

import {
  isCloudValidationError,
  tryExtractValidationError,
  classifyCloudValidationError,
  isValueStillOutOfRange,
  normalizeRelayedNodeErrors
} from '@/utils/executionErrorUtil'

describe('executionErrorUtil', () => {
  describe('isCloudValidationError', () => {
    it('should return true when object has error field', () => {
      expect(isCloudValidationError({ error: 'some error' })).toBe(true)
    })

    it('should return true when object has node_errors field', () => {
      expect(isCloudValidationError({ node_errors: {} })).toBe(true)
    })

    it('should return true when object has both fields', () => {
      expect(isCloudValidationError({ error: 'err', node_errors: {} })).toBe(
        true
      )
    })

    it('should return false for null', () => {
      expect(isCloudValidationError(null)).toBe(false)
    })

    it('should return false for non-object', () => {
      expect(isCloudValidationError('string')).toBe(false)
    })

    it('should return false for object without error or node_errors', () => {
      expect(isCloudValidationError({ foo: 'bar' })).toBe(false)
    })
  })

  describe('tryExtractValidationError', () => {
    it('should extract JSON from a message with embedded validation error', () => {
      const embedded = JSON.stringify({
        error: {
          type: 'prompt_no_outputs',
          message: 'No outputs',
          details: ''
        },
        node_errors: {}
      })
      const message = `Failed to send prompt request: status 400: ${embedded}`

      const result = tryExtractValidationError(message)

      expect(result).not.toBeNull()
      expect(result?.error).toEqual({
        type: 'prompt_no_outputs',
        message: 'No outputs',
        details: ''
      })
    })

    it('should return null when message has no JSON', () => {
      expect(tryExtractValidationError('plain error message')).toBeNull()
    })

    it('should return null when JSON is not a validation error shape', () => {
      const message = 'error: {"foo": "bar"}'
      expect(tryExtractValidationError(message)).toBeNull()
    })

    it('should return null when JSON is malformed', () => {
      const message = 'error: {invalid json'
      expect(tryExtractValidationError(message)).toBeNull()
    })
  })

  describe('classifyCloudValidationError', () => {
    const relayedNodeErrors = {
      '72': {
        class_type: 'CheckpointLoaderSimple',
        dependent_outputs: ['75'],
        errors: [
          {
            type: 'value_not_in_list',
            message: 'Value not in list',
            details: "ckpt_name: 'missing.safetensors' is not a valid value",
            extra_info: {
              input_name: 'ckpt_name',
              received_value: 'missing.safetensors'
            }
          }
        ]
      }
    }
    const summaryOnlyMessage =
      "Prompt outputs failed validation. node 72 (CheckpointLoaderSimple): ckpt_name — value_not_in_list: Value not in list (ckpt_name: 'missing.safetensors' is not a valid value)."
    const embeddedNodeErrors = {
      '9': {
        class_type: 'SaveImage',
        dependent_outputs: ['9'],
        errors: [
          {
            type: 'required_input_missing',
            message: 'Required input is missing',
            details: 'images',
            extra_info: { input_name: 'images' }
          }
        ]
      }
    }

    const rejection = (message: string) => ({
      kind: 'promptError',
      promptError: {
        type: 'prompt_outputs_failed_validation',
        message,
        details: message
      }
    })
    const embeddedMessage = `400: ${JSON.stringify({ node_errors: embeddedNodeErrors })}`

    it.for([
      {
        name: 'a bare-string relayed validation error',
        detail: {
          exception_type: 'ValidationError',
          exception_message: 'Node 72 was rejected.',
          node_errors: {
            '72': {
              class_type: 'CheckpointLoaderSimple',
              dependent_outputs: ['75'],
              errors: ['Custom validator rejected the checkpoint']
            }
          }
        },
        expected: {
          kind: 'nodeErrors',
          nodeErrors: {
            '72': {
              class_type: 'CheckpointLoaderSimple',
              dependent_outputs: ['75'],
              errors: [
                {
                  type: 'error',
                  message: 'Custom validator rejected the checkpoint',
                  details: ''
                }
              ]
            }
          }
        }
      },
      {
        name: 'the relayed node_errors of a validation error',
        detail: {
          exception_type: 'ValidationError',
          exception_message: summaryOnlyMessage,
          node_errors: relayedNodeErrors
        },
        expected: { kind: 'nodeErrors', nodeErrors: relayedNodeErrors }
      },
      {
        name: 'the relayed node_errors, ignoring JSON embedded in the message',
        detail: {
          exception_type: 'ValidationError',
          exception_message: `${summaryOnlyMessage} ${JSON.stringify({ node_errors: embeddedNodeErrors })}`,
          node_errors: relayedNodeErrors
        },
        expected: { kind: 'nodeErrors', nodeErrors: relayedNodeErrors }
      },
      {
        name: 'the valid relayed nodes when a sibling node is malformed',
        detail: {
          exception_type: 'ValidationError',
          exception_message: summaryOnlyMessage,
          node_errors: {
            ...relayedNodeErrors,
            '80': { class_type: 'LoadImage' }
          }
        },
        expected: { kind: 'nodeErrors', nodeErrors: relayedNodeErrors }
      },
      {
        name: 'the valid errors of a relayed node when one of its errors is malformed',
        detail: {
          exception_type: 'ValidationError',
          exception_message: summaryOnlyMessage,
          node_errors: {
            '72': {
              ...relayedNodeErrors['72'],
              errors: [...relayedNodeErrors['72'].errors, { type: 5 }]
            }
          }
        },
        expected: { kind: 'nodeErrors', nodeErrors: relayedNodeErrors }
      },
      {
        name: 'a rejection with the summary when no relayed error is usable',
        detail: {
          exception_type: 'ValidationError',
          exception_message: embeddedMessage,
          node_errors: { '72': { class_type: 'CheckpointLoaderSimple' } }
        },
        expected: rejection(embeddedMessage)
      },
      {
        name: 'the embedded JSON when a non-validation error carries node_errors',
        detail: {
          exception_type: 'RuntimeError',
          exception_message: embeddedMessage,
          node_errors: relayedNodeErrors
        },
        expected: { kind: 'nodeErrors', nodeErrors: embeddedNodeErrors }
      },
      {
        name: 'the embedded JSON when no node_errors are relayed',
        detail: { exception_message: embeddedMessage },
        expected: { kind: 'nodeErrors', nodeErrors: embeddedNodeErrors }
      },
      {
        name: 'only the usable embedded entries when a sibling is null',
        detail: {
          exception_message: `400: ${JSON.stringify({ node_errors: { ...embeddedNodeErrors, '10': null } })}`
        },
        expected: { kind: 'nodeErrors', nodeErrors: embeddedNodeErrors }
      },
      {
        name: 'only the object errors of an embedded node',
        detail: {
          exception_message: `400: ${JSON.stringify({
            node_errors: {
              '9': {
                ...embeddedNodeErrors['9'],
                errors: [...embeddedNodeErrors['9'].errors, null]
              }
            }
          })}`
        },
        expected: { kind: 'nodeErrors', nodeErrors: embeddedNodeErrors }
      },
      {
        name: 'nothing for a summary-only message without node_errors',
        detail: {
          exception_type: 'ValidationError',
          exception_message: summaryOnlyMessage
        },
        expected: null
      },
      {
        name: 'nothing for an empty node_errors map',
        detail: {
          exception_type: 'ValidationError',
          exception_message: summaryOnlyMessage,
          node_errors: {}
        },
        expected: null
      }
    ])('classifies from $name', ({ detail, expected }) => {
      expect(classifyCloudValidationError(detail)).toEqual(expected)
    })

    const rawComfyNodeErrors = {
      '72': {
        ...relayedNodeErrors['72'],
        errors: [
          {
            ...relayedNodeErrors['72'].errors[0],
            extra_info: { input_name: 'image', received_value: ['a.png'] }
          }
        ]
      }
    }

    it.for([
      {
        name: 'raw ComfyUI errors to the summary rejection',
        nodeErrors: rawComfyNodeErrors,
        expected: rejection(summaryOnlyMessage)
      },
      {
        name: 'malformed node metadata to the summary rejection',
        nodeErrors: { '72': { class_type: 'CheckpointLoaderSimple' } },
        expected: rejection(summaryOnlyMessage)
      },
      {
        name: 'contract nodes beside a raw node to those nodes',
        nodeErrors: { ...relayedNodeErrors, '80': rawComfyNodeErrors['72'] },
        expected: { kind: 'nodeErrors', nodeErrors: relayedNodeErrors }
      }
    ])(
      'classifies a job read back from the Jobs API from $name',
      ({ nodeErrors, expected }) => {
        const { execution_error } = zJobDetail.parse({
          id: 'job',
          status: 'failed',
          create_time: 1,
          execution_error: {
            node_id: '72',
            node_type: 'CheckpointLoaderSimple',
            exception_type: 'ValidationError',
            exception_message: summaryOnlyMessage,
            node_errors: nodeErrors
          }
        })

        expect(
          execution_error && classifyCloudValidationError(execution_error)
        ).toEqual(expected)
      }
    )

    it('retains node validation when a sibling entry lacks unused metadata', () => {
      const nodeErrors = {
        '3': {
          class_type: 'KSampler',
          dependent_outputs: [],
          errors: [
            {
              type: 'required_input_missing',
              message: 'Missing',
              details: 'model'
            }
          ]
        },
        '6': {
          class_type: 'SAM3_Detect',
          errors: [
            {
              type: 'required_input_missing',
              message: 'Missing',
              details: 'image'
            }
          ]
        }
      }

      expect(
        classifyCloudValidationError({
          exception_message: `Failed: ${JSON.stringify({ node_errors: nodeErrors })}`
        })
      ).toEqual({ kind: 'nodeErrors', nodeErrors })
    })

    it('should classify node errors when node_errors is present', () => {
      const nodeErrors = {
        '11:1': {
          errors: [
            {
              type: 'required_input_missing',
              message: 'Required input is missing',
              details: 'clip',
              extra_info: { input_name: 'clip' }
            }
          ],
          dependent_outputs: ['9'],
          class_type: 'CLIPTextEncode'
        }
      }
      const embedded = JSON.stringify({
        error: {
          type: 'prompt_outputs_failed_validation',
          message: 'Prompt outputs failed validation',
          details: ''
        },
        node_errors: nodeErrors
      })
      const message = `Failed to send prompt request: status 400: ${embedded}`

      const result = classifyCloudValidationError({
        exception_message: message
      })

      expect(result).toEqual({ kind: 'nodeErrors', nodeErrors })
    })

    it('should classify prompt error when error is an object and no node_errors', () => {
      const embedded = JSON.stringify({
        error: {
          type: 'prompt_no_outputs',
          message: 'Prompt has no outputs',
          details: ''
        }
      })
      const message = `Failed: ${embedded}`

      const result = classifyCloudValidationError({
        exception_message: message
      })

      expect(result).toMatchObject({
        kind: 'promptError',
        promptError: {
          type: 'prompt_no_outputs',
          message: 'Prompt has no outputs'
        }
      })
    })

    it('should classify prompt error when error is a string', () => {
      const embedded = JSON.stringify({ error: 'Something went wrong' })
      const message = `Failed: ${embedded}`

      const result = classifyCloudValidationError({
        exception_message: message
      })

      expect(result).toMatchObject({
        kind: 'promptError',
        promptError: { type: 'error', message: 'Something went wrong' }
      })
    })

    it('should return null when message has no embedded JSON', () => {
      expect(
        classifyCloudValidationError({ exception_message: 'plain error' })
      ).toBeNull()
    })

    it('should return null when embedded JSON has no error or node_errors', () => {
      const message = 'error: {"foo": "bar"}'
      expect(
        classifyCloudValidationError({ exception_message: message })
      ).toBeNull()
    })

    it('should return null when error field is neither object nor string', () => {
      const embedded = JSON.stringify({ error: 123 })
      const message = `Failed: ${embedded}`

      expect(
        classifyCloudValidationError({ exception_message: message })
      ).toBeNull()
    })

    it('should prefer node_errors over error when both present', () => {
      const embedded = JSON.stringify({
        error: { type: 'validation', message: 'fail', details: '' },
        node_errors: {
          '5': {
            errors: [{ type: 'err', message: 'bad', details: '' }],
            dependent_outputs: [],
            class_type: 'KSampler'
          }
        }
      })
      const message = `Failed: ${embedded}`

      const result = classifyCloudValidationError({
        exception_message: message
      })

      expect(result?.kind).toBe('nodeErrors')
    })

    it('should treat empty node_errors as prompt error', () => {
      const embedded = JSON.stringify({
        error: { type: 'no_prompt', message: 'No prompt', details: '' },
        node_errors: {}
      })
      const message = `Failed: ${embedded}`

      const result = classifyCloudValidationError({
        exception_message: message
      })

      expect(result?.kind).toBe('promptError')
    })
  })

  describe('isValueStillOutOfRange', () => {
    it('should return false if there are no errors', () => {
      expect(isValueStillOutOfRange(5, [], {})).toBe(false)
    })

    it('should return true if value is bigger than max', () => {
      const errors = [
        {
          type: 'value_bigger_than_max',
          message: 'too big',
          details: '',
          extra_info: {}
        }
      ]
      expect(isValueStillOutOfRange(15, errors, { max: 10 })).toBe(true)
    })

    it('should return false if value is equal to max but error was value_bigger_than_max', () => {
      const errors = [
        {
          type: 'value_bigger_than_max',
          message: 'too big',
          details: '',
          extra_info: {}
        }
      ]
      expect(isValueStillOutOfRange(10, errors, { max: 10 })).toBe(false)
    })

    it('should return false if value is less than max', () => {
      const errors = [
        {
          type: 'value_bigger_than_max',
          message: 'too big',
          details: '',
          extra_info: {}
        }
      ]
      expect(isValueStillOutOfRange(5, errors, { max: 10 })).toBe(false)
    })

    it('should return true if value is smaller than min', () => {
      const errors = [
        {
          type: 'value_smaller_than_min',
          message: 'too small',
          details: '',
          extra_info: {}
        }
      ]
      expect(isValueStillOutOfRange(1, errors, { min: 5 })).toBe(true)
    })

    it('should return false if value is equal to min but error was value_smaller_than_min', () => {
      const errors = [
        {
          type: 'value_smaller_than_min',
          message: 'too small',
          details: '',
          extra_info: {}
        }
      ]
      expect(isValueStillOutOfRange(5, errors, { min: 5 })).toBe(false)
    })

    it('should return false if value is greater than min', () => {
      const errors = [
        {
          type: 'value_smaller_than_min',
          message: 'too small',
          details: '',
          extra_info: {}
        }
      ]
      expect(isValueStillOutOfRange(10, errors, { min: 5 })).toBe(false)
    })

    it('should return true if both max and min errors exist and value is still out of range', () => {
      const errors = [
        {
          type: 'value_bigger_than_max',
          message: 'too big',
          details: '',
          extra_info: {}
        },
        {
          type: 'value_smaller_than_min',
          message: 'too small',
          details: '',
          extra_info: {}
        }
      ]
      // Value above max — still out of range for the max error
      expect(isValueStillOutOfRange(15, errors, { min: 1, max: 10 })).toBe(true)
    })

    it('should return false if both max and min errors exist but value is in range', () => {
      const errors = [
        {
          type: 'value_bigger_than_max',
          message: 'too big',
          details: '',
          extra_info: {}
        },
        {
          type: 'value_smaller_than_min',
          message: 'too small',
          details: '',
          extra_info: {}
        }
      ]
      expect(isValueStillOutOfRange(5, errors, { min: 1, max: 10 })).toBe(false)
    })

    it('should return true if max is undefined but error was value_bigger_than_max (conservative)', () => {
      const errors = [
        {
          type: 'value_bigger_than_max',
          message: 'too big',
          details: '',
          extra_info: {}
        }
      ]
      expect(isValueStillOutOfRange(15, errors, {})).toBe(true)
    })

    it('should return true if min is undefined but error was value_smaller_than_min (conservative)', () => {
      const errors = [
        {
          type: 'value_smaller_than_min',
          message: 'too small',
          details: '',
          extra_info: {}
        }
      ]
      expect(isValueStillOutOfRange(0, errors, {})).toBe(true)
    })

    it('should return false when errors contain only non-range types', () => {
      const errors = [
        {
          type: 'value_not_in_list',
          message: 'not in list',
          details: '',
          extra_info: {}
        }
      ]
      expect(isValueStillOutOfRange(5, errors, { min: 1, max: 10 })).toBe(false)
    })
  })

  describe('normalizeRelayedNodeErrors', () => {
    it('drops a node none of whose errors can be shown', () => {
      const inputError = {
        type: 'required_input_missing',
        message: 'Required input is missing',
        details: 'images'
      }

      expect(
        normalizeRelayedNodeErrors({
          '9': {
            class_type: 'SaveImage',
            dependent_outputs: ['9'],
            errors: [inputError]
          },
          '10': {
            class_type: 'SaveImage',
            dependent_outputs: ['10'],
            errors: []
          }
        })
      ).toEqual({
        '9': {
          class_type: 'SaveImage',
          dependent_outputs: ['9'],
          errors: [inputError]
        }
      })
    })
  })
})
