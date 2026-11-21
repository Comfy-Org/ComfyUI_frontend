import { beforeEach, describe, expect, it } from 'vitest'

import type {
  AgentErrorContext,
  AgentErrorProblem
} from '@/platform/workflowErrors/agentErrorContext'

import {
  takePendingSignInAccept,
  writePendingSignInAccept
} from './pendingSignInAccept'

const STORAGE_KEY = 'Comfy.AgentPanel.PendingSignInAccept'

const ENVELOPE: Omit<AgentErrorContext, 'problems'> = {
  scope: 'single',
  count: 1,
  label: 'Out of memory',
  severity: 'error'
}

function contextWithProblem(problem: AgentErrorProblem): AgentErrorContext {
  return { ...ENVELOPE, problems: [problem] }
}

function storeProblem(problem: Record<string, unknown>): void {
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      draft: 'help',
      errorContext: { ...ENVELOPE, problems: [problem] },
      savedAt: Date.now()
    })
  )
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
    storeProblem({
      category: 'execution_failure',
      message: 'CUDA out of memory',
      [field as string]: value
    })

    expect(takePendingSignInAccept()).toEqual({ draft: 'help' })
  })
})
