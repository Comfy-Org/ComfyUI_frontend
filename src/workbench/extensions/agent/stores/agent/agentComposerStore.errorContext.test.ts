import { describe, expect, it } from 'vitest'

import type { AgentErrorContext } from '../../types/agentErrorContext'
import { useAgentComposerStore } from './agentComposerStore'

function errorContext(
  overrides: Partial<AgentErrorContext> = {}
): AgentErrorContext {
  return {
    scope: 'card',
    count: 2,
    label: 'Missing Inputs',
    severity: 'warning',
    problems: [
      { category: 'missing_media', message: 'image missing' },
      { category: 'missing_media', message: 'video missing' }
    ],
    ...overrides
  }
}

describe('agentComposerStore error context', () => {
  it('attaches context and marks the draft origin as error context', () => {
    const store = useAgentComposerStore()

    store.setErrorContext(errorContext())

    expect(store.errorContext).toEqual(errorContext())
    expect(store.promptOrigin).toBe('error_context')
  })

  it('clears context and restores the typed origin on removal', () => {
    const store = useAgentComposerStore()
    store.setErrorContext(errorContext())

    store.clearErrorContext()

    expect(store.errorContext).toBeNull()
    expect(store.promptOrigin).toBe('typed')
  })

  it('leaves a typed draft able to send on its own after removing the chip', () => {
    const store = useAgentComposerStore()
    store.setText('explain this')
    store.setErrorContext(errorContext())

    store.clearErrorContext()

    expect(store.errorContext).toBeNull()
    expect(store.draft).toBe('explain this')
  })

  it('drops the attached context when a submission starts', () => {
    const store = useAgentComposerStore()
    store.setErrorContext(errorContext())

    store.startSubmission({
      prompt: { text: '', references: [] },
      attachments: [],
      nodes: [],
      target: { isTemporary: true } as never
    })

    expect(store.errorContext).toBeNull()
  })

  it('restores the attached context when a send fails', () => {
    const store = useAgentComposerStore()
    const context = errorContext()
    store.setErrorContext(context)

    const id = store.startSubmission({
      prompt: { text: '', references: [] },
      attachments: [],
      nodes: [],
      target: { isTemporary: true } as never
    })
    store.settleSubmission(id, false)
    const snapshot = store.takeFailedSubmission()

    expect(snapshot).toBeDefined()
    expect(store.errorContext).toEqual(context)
    expect(store.promptOrigin).toBe('error_context')
  })
})
