import { assert, describe, expect, it } from 'vitest'

import { useAgentComposerStore } from './agentComposerStore'

describe('greeting draft ownership', () => {
  it('clears only its own untouched insertion', () => {
    const composer = useAgentComposerStore()
    const release = composer.prefillGreeting('What can you help me with?')
    assert.exists(release)
    expect(composer.draft).toBe('What can you help me with?')
    release()
    expect(composer.draft).toBe('')
  })

  it('preserves text retyped identically by the user', () => {
    const composer = useAgentComposerStore()
    const release = composer.prefillGreeting('Help me improve this workflow')
    assert.exists(release)
    composer.setText('')
    composer.setText('Help me improve this workflow')
    release()
    expect(composer.draft).toBe('Help me improve this workflow')
  })

  it('does not claim pre-existing identical text or a referenced draft', () => {
    const composer = useAgentComposerStore()
    composer.setText('What can you help me with?')
    expect(
      composer.prefillGreeting('What can you help me with?')
    ).toBeUndefined()
    composer.setText('')
    composer.setWorkflowReferences([
      { id: 'reference', name: 'Reference', textOffset: 0 }
    ])
    expect(
      composer.prefillGreeting('What can you help me with?')
    ).toBeUndefined()
    expect(composer.workflowReferences).toHaveLength(1)
  })
})
