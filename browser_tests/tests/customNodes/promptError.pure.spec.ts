import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  LocalDesktopTarget,
  summarizePromptError,
  toPromptEvent
} from '@e2e/fixtures/customNode/ComfyTarget'

import type { Page, Response } from '@playwright/test'

// The curated-run happy path never executes summarizePromptError (it only
// runs on a VALIDATION_FAIL), so these cases keep a curated workflow rejection
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

test('normalizes trailing backend whitespace without changing the message', () => {
  expect(
    toPromptEvent({
      type: 'execution_error',
      exception_message: 'Error node was called!\n'
    })
  ).toMatchObject({
    type: 'execution_error',
    error: { exceptionMessage: 'Error node was called!' }
  })
  expect(
    toPromptEvent({
      type: 'execution_error',
      exception_message: ' leading whitespace is content \r\n'
    })
  ).toMatchObject({
    error: { exceptionMessage: ' leading whitespace is content' }
  })
})

test('returns a captured prompt rejection without waiting for execution events', async () => {
  const listeners = new Set<(response: Response) => void>()
  let evaluateCalls = 0
  let waitedForExecution = false
  const response = {
    request: () => ({ method: () => 'POST' }),
    url: () => 'http://backend/api/prompt',
    status: () => 500,
    json: () =>
      Promise.resolve({
        error: { message: 'prompt rejected' },
        node_errors: {}
      })
  } as unknown as Response
  const page = {
    on: (_event: string, listener: (value: Response) => void) => {
      listeners.add(listener)
    },
    off: (_event: string, listener: (value: Response) => void) => {
      listeners.delete(listener)
    },
    evaluate: async () => {
      evaluateCalls += 1
      if (evaluateCalls === 1) return []
      for (const listener of listeners) listener(response)
      return true
    },
    waitForFunction: async () => {
      waitedForExecution = true
      throw new Error('a rejected submission cannot emit execution events')
    }
  } as unknown as Page

  const result = await new LocalDesktopTarget().runWorkflow(page, {
    expectedNodeIds: ['1'],
    timeoutMs: 60_000
  })

  expect(result).toEqual({
    outcome: 'VALIDATION_FAIL',
    executedNodes: [],
    outputsByNode: {},
    clientError: 'prompt rejected'
  })
  expect(waitedForExecution).toBe(false)
  expect(listeners.size).toBe(0)
})

test('returns a non-JSON prompt rejection without waiting for execution events', async () => {
  const listeners = new Set<(response: Response) => void>()
  let evaluateCalls = 0
  let waitedForExecution = false
  const response = {
    request: () => ({ method: () => 'POST' }),
    url: () => 'http://backend/api/prompt',
    status: () => 502,
    json: () => Promise.reject(new SyntaxError('proxy HTML'))
  } as unknown as Response
  const page = {
    on: (_event: string, listener: (value: Response) => void) => {
      listeners.add(listener)
    },
    off: (_event: string, listener: (value: Response) => void) => {
      listeners.delete(listener)
    },
    evaluate: async () => {
      evaluateCalls += 1
      if (evaluateCalls === 1) return []
      for (const listener of listeners) listener(response)
      return true
    },
    waitForFunction: async () => {
      waitedForExecution = true
      throw new Error('a rejected submission cannot emit execution events')
    }
  } as unknown as Page

  const result = await new LocalDesktopTarget().runWorkflow(page, {
    expectedNodeIds: ['1'],
    timeoutMs: 60_000
  })

  expect(result).toEqual({
    outcome: 'VALIDATION_FAIL',
    executedNodes: [],
    outputsByNode: {},
    clientError: 'HTTP 502 prompt submission failed'
  })
  expect(waitedForExecution).toBe(false)
  expect(listeners.size).toBe(0)
})

test('keeps a successful retry when the older rejection body parses last', async () => {
  const listeners = new Set<(response: Response) => void>()
  let evaluateCalls = 0
  const response = (status: number, body: unknown, delayMs = 0): Response =>
    ({
      request: () => ({ method: () => 'POST' }),
      url: () => 'http://backend/api/prompt',
      status: () => status,
      json: () =>
        new Promise((resolve) => setTimeout(() => resolve(body), delayMs))
    }) as unknown as Response
  const page = {
    on: (_event: string, listener: (value: Response) => void) => {
      listeners.add(listener)
    },
    off: (_event: string, listener: (value: Response) => void) => {
      listeners.delete(listener)
    },
    evaluate: async () => {
      evaluateCalls += 1
      if (evaluateCalls === 1) return []
      if (evaluateCalls === 2) {
        for (const listener of listeners)
          listener(
            response(500, { error: { message: 'older rejection' } }, 300)
          )
        return false
      }
      if (evaluateCalls === 3) {
        for (const listener of listeners)
          listener(response(200, { prompt_id: 'successful-retry' }))
        return true
      }
      return [{ type: 'execution_success', prompt_id: 'successful-retry' }]
    },
    waitForFunction: async () => {}
  } as unknown as Page

  const result = await new LocalDesktopTarget().runWorkflow(page, {
    expectedNodeIds: [],
    timeoutMs: 60_000
  })

  expect(result.outcome).toBe('PASS')
  expect(result.clientError).toBeUndefined()
  expect(listeners.size).toBe(0)
})
