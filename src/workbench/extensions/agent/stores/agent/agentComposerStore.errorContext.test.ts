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
  it('attaches the context as an inline reference and marks the origin', () => {
    const store = useAgentComposerStore()

    store.setErrorContext(errorContext())

    expect(store.errorContext).toEqual(errorContext())
    expect(
      store.prompt.references.filter((r) => r.kind === 'error')
    ).toHaveLength(1)
    expect(store.promptOrigin).toBe('error_context')
  })

  it('replaces an existing error reference rather than stacking', () => {
    const store = useAgentComposerStore()
    store.setErrorContext(errorContext({ label: 'First' }))

    store.setErrorContext(errorContext({ label: 'Second' }))

    const errors = store.prompt.references.filter((r) => r.kind === 'error')
    expect(errors).toHaveLength(1)
    expect(store.errorContext?.label).toBe('Second')
  })

  it('removes the reference and restores the typed origin on clear', () => {
    const store = useAgentComposerStore()
    store.setErrorContext(errorContext())

    store.clearErrorContext()

    expect(store.errorContext).toBeNull()
    expect(store.prompt.references.some((r) => r.kind === 'error')).toBe(false)
    expect(store.promptOrigin).toBe('typed')
  })

  it('leaves a typed draft able to send on its own after removing the chip', () => {
    const store = useAgentComposerStore()
    store.setText('explain this')
    store.setErrorContext(errorContext())

    store.clearErrorContext()

    expect(store.errorContext).toBeNull()
    expect(store.draft.trim()).toBe('explain this')
  })

  it('resets the error-context origin when the reference is removed via the editor', () => {
    const store = useAgentComposerStore()
    store.setErrorContext(errorContext())

    store.applyEditorPrompt({ text: '', references: [] })

    expect(store.errorContext).toBeNull()
    expect(store.promptOrigin).toBe('typed')
  })

  it('drops the attached context when a submission starts', () => {
    const store = useAgentComposerStore()
    store.setErrorContext(errorContext())

    store.startSubmission({
      prompt: store.prompt,
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
    const snapshotPrompt = store.prompt

    const id = store.startSubmission({
      prompt: snapshotPrompt,
      attachments: [],
      nodes: [],
      target: { isTemporary: true } as never
    })
    store.settleSubmission(id, false)
    const snapshot = store.takeFailedSubmission()
    expect(snapshot).toBeDefined()
    store.restorePrompt(snapshot!.prompt)

    expect(store.errorContext).toEqual(context)
    expect(store.promptOrigin).toBe('error_context')
  })
})
