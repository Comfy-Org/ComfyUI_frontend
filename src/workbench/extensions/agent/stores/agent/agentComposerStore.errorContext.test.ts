import { describe, expect, it } from 'vitest'

import type { AgentErrorContext } from '@/platform/workflowErrors/agentErrorContext'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

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
  it('keeps references in text order when a new chip replaces the old one', () => {
    const store = useAgentComposerStore()
    store.setErrorContext(errorContext({ label: 'First' }))
    const typed = ' Can you fix this'
    store.applyEditorPrompt({
      text: typed,
      references: [
        ...store.prompt.references,
        { kind: 'workflow', id: 'wf-ref', name: 'other', textOffset: 17 }
      ]
    })
    store.setInsertionPoint({ textOffset: 4, referenceIndex: 1 })

    store.setErrorContext(errorContext({ label: 'Second' }))

    expect(store.prompt.text).toBe(' Can you fix this')
    expect(store.prompt.references).toMatchObject([
      { kind: 'error', context: { label: 'Second' }, textOffset: 4 },
      { kind: 'workflow', id: 'wf-ref', name: 'other', textOffset: 17 }
    ])
  })

  it('inserts between two references at the same offset when the caret is between them', () => {
    const store = useAgentComposerStore()
    store.applyEditorPrompt({
      text: '',
      references: [
        { kind: 'workflow', id: 'wf-a', name: 'a', textOffset: 0 },
        { kind: 'workflow', id: 'wf-b', name: 'b', textOffset: 0 }
      ]
    })
    store.setInsertionPoint({ textOffset: 0, referenceIndex: 1 })

    store.setErrorContext(errorContext())

    expect(store.prompt.references.map((item) => item.kind)).toEqual([
      'workflow',
      'error',
      'workflow'
    ])
    expect(store.prompt.references[0]).toMatchObject({ id: 'wf-a' })
  })

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
      target: createMockLoadedWorkflow({ path: 'workflows/target.json' })
    })

    expect(store.errorContext).toBeNull()
  })
})
