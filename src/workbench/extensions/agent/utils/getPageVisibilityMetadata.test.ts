import { describe, expect, it } from 'vitest'

import { useAgentPanelStore } from '../stores/agent/agentPanelStore'
import { getPageVisibilityMetadata } from './getPageVisibilityMetadata'

describe('getPageVisibilityMetadata', () => {
  it('reports the panel as closed when it is not visible', () => {
    expect(getPageVisibilityMetadata('visible')).toEqual({
      visibility_state: 'visible',
      agent_panel_open: false
    })
  })

  it('reports the panel as open when it is docked and visible', () => {
    const store = useAgentPanelStore()
    store.enabled = true
    store.consentAccepted = true
    store.open()

    expect(getPageVisibilityMetadata('hidden')).toEqual({
      visibility_state: 'hidden',
      agent_panel_open: true
    })
  })
})
