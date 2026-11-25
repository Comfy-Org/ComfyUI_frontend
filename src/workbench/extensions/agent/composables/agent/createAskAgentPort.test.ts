import { getActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { createAskAgentPort } from './createAskAgentPort'

vi.mock(import('firebase/auth'))

function instantiatedStores() {
  return Object.keys(getActivePinia()!.state.value)
}

describe('createAskAgentPort', () => {
  it('does not create the composer store, whose draft key is the workspace at creation time', () => {
    const port = createAskAgentPort()

    expect(instantiatedStores()).not.toContain('agentComposer')

    expect(port.canAskAgent.value).toBe(false)
    expect(instantiatedStores()).not.toContain('agentComposer')
  })
})
