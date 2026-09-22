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
    localStorage.setItem('Comfy.AgentPanel.open', 'true')
    // Spy the instance, not Storage.prototype: happy-dom's localStorage does
    // not route through the prototype spy, so that form would pass whether or
    // not the guard exists. Seeding 'true' first means an unguarded read would
    // return true, so the assertion can only hold if the throw is caught.
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(getAgentPanelOpen()).toBe(false)
  })
})
