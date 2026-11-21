import { beforeEach, describe, expect, it } from 'vitest'

import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'

import {
  takePendingSignInAccept,
  writePendingSignInAccept
} from './pendingSignInAccept'

const STORAGE_KEY = 'Comfy.AgentPanel.PendingSignInAccept'

function contextWithProblem(
  problem: Record<string, unknown>
): AgentErrorContext {
  return {
    scope: 'single',
    count: 1,
    label: 'Out of memory',
    severity: 'error',
    problems: [problem as unknown as AgentErrorContext['problems'][number]]
  }
}

beforeEach(() => {
  window.sessionStorage.clear()
})

describe('pendingSignInAccept error context', () => {
  it('round-trips a problem carrying catalogId and jobId', () => {
    const errorContext = contextWithProblem({
      category: 'execution_failure',
      catalogId: 'server_out_of_memory',
      jobId: 'prompt-123',
      message: 'CUDA out of memory'
    })

    writePendingSignInAccept({ draft: 'help', errorContext })

    expect(takePendingSignInAccept()).toEqual({ draft: 'help', errorContext })
  })

  it.for([
    ['catalogId', 42],
    ['jobId', { id: 'prompt-123' }]
  ])('drops the error context when %s is not a string', ([field, value]) => {
    const errorContext = contextWithProblem({
      category: 'execution_failure',
      message: 'CUDA out of memory',
      [field as string]: value
    })
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ draft: 'help', errorContext, savedAt: Date.now() })
    )

    expect(takePendingSignInAccept()).toEqual({ draft: 'help' })
  })
})
