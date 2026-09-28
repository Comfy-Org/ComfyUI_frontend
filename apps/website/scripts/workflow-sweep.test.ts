import { assert, describe, expect, it } from 'vitest'

import { workflowDetailsBySlug } from '../src/config/workshop-workflow-content'
import type { WorkflowRunResult } from './workflow-sweep'
import {
  checkPassed,
  cloudErrorOf,
  failureReason,
  parseRepeats,
  runPassed,
  settledRunOutcome,
  workflowChecks,
  workflowSweepMarkdown
} from './workflow-sweep'

const passed: WorkflowRunResult = {
  slug: 'workflows/remove-background',
  attempt: 1,
  status: 'passed',
  seconds: 11,
  runId: 'run-1',
  outputs: [{ kind: 'image', status: 206 }]
}

describe('workflow page sweep', () => {
  it('checks the page, both graph files and every sample and example URL', () => {
    const detail = workflowDetailsBySlug.get('workflows/change-material')
    assert.exists(detail)
    const checks = workflowChecks(detail, 'https://comfy.org')

    expect(checks.filter((check) => check.kind === 'page')).toEqual([
      {
        slug: 'workflows/change-material',
        kind: 'page',
        url: 'https://comfy.org/models/workflows/change-material/'
      }
    ])
    expect(
      checks.filter((check) => check.kind === 'graph').map(({ url }) => url)
    ).toEqual([
      'https://comfy.org/workflow-graphs/change-material.svg',
      'https://comfy.org/workflow-graphs/change-material.json'
    ])
    const media = checks.filter((check) => check.kind === 'media')
    expect(media.length).toBeGreaterThan(0)
    expect(media.every(({ url }) => url.startsWith('https://'))).toBe(true)
    expect(new Set(media.map(({ url }) => url)).size).toBe(media.length)
  })

  it.for([
    { status: 200, passes: true },
    { status: 206, passes: true },
    { status: 404, passes: false },
    { status: 'error' as const, passes: false }
  ])('treats a $status response as passes=$passes', ({ status, passes }) => {
    expect(
      checkPassed({ slug: 's', kind: 'media', url: 'https://x', status })
    ).toBe(passes)
  })

  it.for([
    { label: 'a delivered run', run: passed, passes: true },
    {
      label: 'a failed run',
      run: { ...passed, status: 'failed' as const },
      passes: false
    },
    {
      label: 'a run with no outputs',
      run: { ...passed, outputs: [] },
      passes: false
    },
    {
      label: 'an output that does not download',
      run: { ...passed, outputs: [{ kind: 'video', status: 403 }] },
      passes: false
    }
  ])('passes $label: $passes', ({ run, passes }) => {
    expect(runPassed(run)).toBe(passes)
  })

  it("keeps Cloud's failing node and message", () => {
    expect(
      cloudErrorOf({
        status: 'failed',
        execution_error: {
          node_type: 'GeminiImage2Node',
          exception_message:
            'Unauthorized: Please login first to use this node.\n',
          traceback: ['long']
        }
      })
    ).toEqual({
      nodeType: 'GeminiImage2Node',
      message: 'Unauthorized: Please login first to use this node.'
    })
    expect(cloudErrorOf({ status: 'completed' })).toBeUndefined()
    expect(cloudErrorOf(undefined)).toBeUndefined()
  })

  it('reports failures with their Cloud cause and escapes table cells', () => {
    const markdown = workflowSweepMarkdown(
      [
        { slug: 'a', kind: 'page', url: 'https://comfy.org/a/', status: 200 },
        {
          slug: 'b',
          kind: 'graph',
          url: 'https://comfy.org/b.svg',
          status: 404
        }
      ],
      [
        passed,
        {
          ...passed,
          slug: 'workflows/replace-character',
          status: 'failed',
          outputs: [],
          reason: 'Cloud run failed',
          cloudError: {
            nodeType: 'ComfyMathExpression',
            message: "'b' is not defined | (b - c)"
          }
        }
      ]
    )
    expect(markdown).toContain('Free checks: 1/2 passed.')
    expect(markdown).toContain('- graph b: 404 https://comfy.org/b.svg')
    expect(markdown).toContain('Live runs: 1/2 passed.')
    expect(markdown).toContain(
      "Cloud run failed · ComfyMathExpression · 'b' is not defined \\| (b - c)"
    )
  })
})

describe('workflow sweep inputs and outcomes', () => {
  it('parses page repeats and rejects malformed or unbounded counts', () => {
    expect(parseRepeats(['workflows/a=3', 'workflows/b=1'])).toEqual(
      new Map([
        ['workflows/a', 3],
        ['workflows/b', 1]
      ])
    )
    for (const bad of ['workflows/a', 'workflows/a=0', 'workflows/a=11', '=2'])
      expect(() => parseRepeats([bad])).toThrow('--repeat expects')
  })

  it.for([
    {
      state: 'succeeded',
      selected: 2,
      delivered: 2,
      expected: { status: 'passed' }
    },
    {
      state: 'failed',
      selected: 1,
      delivered: 0,
      expected: { status: 'failed', reason: 'Cloud run failed' }
    },
    {
      state: 'succeeded',
      selected: 4,
      delivered: 3,
      expected: { status: 'failed', reason: '1 of 4 outputs not delivered' }
    },
    {
      state: 'succeeded',
      selected: 2,
      delivered: 0,
      expected: { status: 'failed', reason: '2 of 2 outputs not delivered' }
    }
  ])(
    'classifies a $state run with $delivered of $selected outputs',
    ({ state, selected, delivered, expected }) => {
      expect(settledRunOutcome(state, selected, delivered)).toEqual(expected)
    }
  )
})

it('names a failure by its workflow error code, else its message', () => {
  expect(
    failureReason(Object.assign(new Error('x'), { code: 'invalid_input' }))
  ).toBe('invalid_input')
  expect(failureReason(new Error('socket hang up'))).toBe(
    'Error: socket hang up'
  )
  expect(failureReason(null)).toBe('null')
})
