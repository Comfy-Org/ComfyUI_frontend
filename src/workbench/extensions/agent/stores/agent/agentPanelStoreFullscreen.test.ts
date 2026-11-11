import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AgentExperience } from '@/workbench/extensions/agent/experiments/chatRedesign'
import { useAgentPanelStore } from './agentPanelStore'

vi.mock(import('@comfyorg/telemetry'))

function resizeWindowTo(px: number): void {
  window.innerWidth = px
  window.dispatchEvent(new Event('resize'))
}

function useVisibleAgentPanelStore(experience: AgentExperience) {
  const store = useAgentPanelStore()
  store.enabled = true
  store.experience = experience
  store.open()
  return store
}

describe('agentPanelStore full screen', () => {
  beforeEach(() => {
    localStorage.clear()
    resizeWindowTo(1920)
  })

  it('expands to full screen in the redesign', () => {
    const store = useVisibleAgentPanelStore('redesign')

    store.toggleMaximize()

    expect(store.presentation).toEqual({ kind: 'fullscreen' })
    expect(store.isFullscreen).toBe(true)
    expect(store.isMaximized).toBe(false)
  })

  it('still widens to 960 in the classic experience', () => {
    const store = useVisibleAgentPanelStore('classic')

    store.toggleMaximize()

    expect(store.presentation).toEqual({ kind: 'docked', width: 960 })
    expect(store.isFullscreen).toBe(false)
  })

  it('does not offer full screen on a phone-width window', () => {
    const store = useVisibleAgentPanelStore('redesign')
    resizeWindowTo(600)

    store.toggleMaximize()

    expect(store.isFullscreen).toBe(false)
    expect(store.isMaximized).toBe(true)
  })

  it('falls back to the dock while the window is phone-width and returns after', () => {
    const store = useVisibleAgentPanelStore('redesign')
    store.setPanelMounted(true)
    store.toggleMaximize()

    resizeWindowTo(600)

    expect(store.isFullscreen).toBe(false)
    expect(store.coversWorkspace).toBe(false)
    expect(store.prefersFullscreen).toBe(true)
    expect(store.presentation.kind).toBe('overlay')

    resizeWindowTo(1920)

    expect(store.isFullscreen).toBe(true)
  })

  it('restores full screen from the dock', () => {
    const store = useVisibleAgentPanelStore('redesign')

    store.restoreFullscreen()

    expect(store.isFullscreen).toBe(true)
    expect(store.presentation).toEqual({ kind: 'fullscreen' })
  })

  it('keeps reporting the docked width while full screen and returns to it', () => {
    const store = useVisibleAgentPanelStore('redesign')
    store.setWidth(700)

    store.toggleMaximize()
    expect(store.width).toBe(700)

    store.toggleMaximize()
    expect(store.presentation).toEqual({ kind: 'docked', width: 700 })
  })

  it('covers the workspace only while the panel is mounted', () => {
    const store = useVisibleAgentPanelStore('redesign')
    store.toggleMaximize()
    expect(store.coversWorkspace).toBe(false)

    store.setPanelMounted(true)
    expect(store.coversWorkspace).toBe(true)

    store.setPanelMounted(false)
    expect(store.coversWorkspace).toBe(false)
  })

  it('stops covering the workspace when full screen is exited', () => {
    const store = useVisibleAgentPanelStore('redesign')
    store.setPanelMounted(true)
    store.toggleMaximize()

    store.exitFullscreen('graph_reveal')

    expect(store.isFullscreen).toBe(false)
    expect(store.coversWorkspace).toBe(false)
  })

  it('reopens docked after being closed from full screen', () => {
    const store = useVisibleAgentPanelStore('redesign')
    store.toggleMaximize()

    store.close('close_button')
    store.open()

    expect(store.isFullscreen).toBe(false)
    expect(store.presentation).toEqual({ kind: 'docked', width: 420 })
  })
})

describe('agentPanelStore sidebar section', () => {
  beforeEach(() => {
    localStorage.clear()
    resizeWindowTo(1920)
  })

  it('starts on the chats', () => {
    const store = useVisibleAgentPanelStore('redesign')

    expect(store.sidebarSection).toBe('chats')
  })

  it('shows the chosen section and leaves an open sidebar open', () => {
    const store = useVisibleAgentPanelStore('redesign')
    store.toggleMaximize()

    store.showSidebarSection('apps')

    expect(store.sidebarSection).toBe('apps')
    expect(store.sidebarMode).toBe('expanded')
  })

  it.for([
    { windowWidth: 1920, opened: 'expanded' },
    { windowWidth: 800, opened: 'drawer' }
  ] as const)(
    'opens the rail into the $opened sidebar when a section is chosen at $windowWidth',
    ({ windowWidth, opened }) => {
      const store = useVisibleAgentPanelStore('redesign')
      store.toggleMaximize()
      store.toggleSidebar()
      resizeWindowTo(windowWidth)
      expect(store.sidebarMode).toBe('rail')

      store.showSidebarSection('workflows')

      expect(store.sidebarSection).toBe('workflows')
      expect(store.sidebarMode).toBe(opened)
    }
  )

  it.for([
    {
      leave: 'the graph is revealed',
      act: (store: ReturnType<typeof useAgentPanelStore>) =>
        store.exitFullscreen('graph_reveal')
    },
    {
      leave: 'the size is toggled',
      act: (store: ReturnType<typeof useAgentPanelStore>) =>
        store.toggleMaximize()
    },
    {
      leave: 'the panel is closed',
      act: (store: ReturnType<typeof useAgentPanelStore>) =>
        store.close('close_button')
    }
  ])('returns to the chats when $leave', ({ act }) => {
    const store = useVisibleAgentPanelStore('redesign')
    store.toggleMaximize()
    store.showSidebarSection('apps')

    act(store)

    expect(store.isFullscreen).toBe(false)
    expect(store.sidebarSection).toBe('chats')
  })
})
