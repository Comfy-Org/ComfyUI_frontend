import { describe, expect, it, vi } from 'vitest'

import { getAgentPanelOpen } from './getAgentPanelOpen'

describe('getAgentPanelOpen', () => {
  it('reports false when no preference is stored', () => {
    expect(getAgentPanelOpen()).toBe(false)
  })

  it('reports false when the panel is closed', () => {
    localStorage.setItem('Comfy.AgentPanel.open', 'false')
    expect(getAgentPanelOpen()).toBe(false)
  })

  it('reports true when the panel is open', () => {
    localStorage.setItem('Comfy.AgentPanel.open', 'true')
    expect(getAgentPanelOpen()).toBe(true)
  })

  it('reports false when storage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(getAgentPanelOpen()).toBe(false)
  })
})
