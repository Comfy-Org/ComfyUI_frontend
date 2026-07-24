import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { summarizePromptError } from '@e2e/fixtures/customNode/ComfyTarget'

// The curated-run happy path never executes summarizePromptError (it only
// runs on a VALIDATION_FAIL), so these cases are what keep a T1 rejection
// naming the node+input instead of rotting back to `{}`.
test.describe('summarizePromptError', () => {
  test('names the node class and the failing input from node_errors', () => {
    const body = {
      error: { type: 'prompt_outputs_failed_validation', message: 'failed' },
      node_errors: {
        '7': {
          class_type: 'ImpactInt',
          errors: [
            { type: 'value_not_in_list', message: 'msg', details: 'value' }
          ],
          dependent_outputs: []
        }
      }
    }
    expect(summarizePromptError(body)).toBe('failed; ImpactInt: value')
  })

  test('accepts a string top-level error', () => {
    expect(summarizePromptError({ error: 'bad request' })).toBe('bad request')
  })

  test('falls back to the node message when details is empty', () => {
    const body = {
      node_errors: {
        '3': {
          class_type: 'KSampler',
          errors: [
            { type: 'x', message: 'required input missing', details: '' }
          ],
          dependent_outputs: []
        }
      }
    }
    expect(summarizePromptError(body)).toBe('KSampler: required input missing')
  })

  test('returns undefined for an empty or non-object body', () => {
    expect(summarizePromptError({})).toBeUndefined()
    expect(summarizePromptError(null)).toBeUndefined()
    expect(summarizePromptError('not an object')).toBeUndefined()
  })
})
