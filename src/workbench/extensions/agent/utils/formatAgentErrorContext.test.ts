import { describe, expect, it } from 'vitest'

import type { AgentErrorContext } from '../types/agentErrorContext'
import { formatAgentErrorContext } from './formatAgentErrorContext'

function context(
  overrides: Partial<AgentErrorContext> = {}
): AgentErrorContext {
  return {
    scope: 'card',
    count: 1,
    label: 'Missing media',
    severity: 'warning',
    problems: [
      {
        category: 'missing_media',
        message: 'A required media input has no file selected.',
        nodeId: '12',
        nodeType: 'LoadImage',
        nodeTitle: 'Load Image'
      }
    ],
    ...overrides
  }
}

describe('formatAgentErrorContext', () => {
  it('includes scope, count, workflow, node reference, and the message', () => {
    const block = formatAgentErrorContext(
      context({ workflowName: 'My Workflow' })
    )

    expect(block).toContain('1 workflow issue')
    expect(block).toContain("one issue card's group of problems")
    expect(block).toContain('Workflow: My Workflow')
    expect(block).toContain(
      '1. [Missing media] Load Image, type LoadImage, node #12'
    )
    expect(block).toContain('A required media input has no file selected.')
  })

  it('leads with the user request when one is typed', () => {
    const block = formatAgentErrorContext(context(), 'Can you fix this for me?')

    expect(block.startsWith('Can you fix this for me?\n\n')).toBe(true)
  })

  it('omits the user request when it is blank', () => {
    const block = formatAgentErrorContext(context(), '   ')

    expect(block.startsWith('I need help with')).toBe(true)
  })

  it('pluralizes the issue count', () => {
    const block = formatAgentErrorContext(
      context({
        count: 2,
        problems: [
          {
            category: 'missing_model',
            message: 'model-a.safetensors not found'
          },
          { category: 'execution_failure', message: 'RuntimeError: boom' }
        ]
      })
    )

    expect(block).toContain('2 workflow issues')
    expect(block).toContain(
      '1. [Missing model]\n   model-a.safetensors not found'
    )
    expect(block).toContain('2. [Execution failure]\n   RuntimeError: boom')
  })

  it('includes and indents details, truncating very long logs', () => {
    const withDetails = formatAgentErrorContext(
      context({
        problems: [
          {
            category: 'execution_failure',
            message: 'RuntimeError: boom',
            details: 'line one\nline two'
          }
        ]
      })
    )
    expect(withDetails).toContain('   Details: line one\n   line two')

    const longDetails = formatAgentErrorContext(
      context({
        problems: [
          {
            category: 'execution_failure',
            message: 'RuntimeError: boom',
            details: 'x'.repeat(5000)
          }
        ]
      })
    )
    expect(longDetails).toContain('… (truncated)')
  })

  it('always carries the agent guidance about stale vs current state', () => {
    const block = formatAgentErrorContext(context())

    expect(block).toContain('Re-check the current graph state')
    expect(block).toContain(
      'do not treat passing graph validation as resolving missing assets'
    )
  })
})
