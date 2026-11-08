import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentPanelStore } from './agentPanelStore'

vi.mock(import('@comfyorg/telemetry'))

function resizeWindowTo(px: number): void {
  window.innerWidth = px
  window.dispatchEvent(new Event('resize'))
}

function useVisibleAgentPanelStore() {
  const store = useAgentPanelStore()
  store.enabled = true
  store.open()
  return store
}

describe('agentPanelStore size', () => {
  beforeEach(() => {
    localStorage.clear()
    resizeWindowTo(1920)
  })

  it('presents a panel that is not on screen as hidden', () => {
    const store = useAgentPanelStore()

    expect(store.presentation).toEqual({ kind: 'hidden' })
  })

  it('presents a visible panel docked at the width it was dragged to', () => {
    const store = useVisibleAgentPanelStore()

    store.setWidth(700)

    expect(store.presentation).toEqual({ kind: 'docked', width: 700 })
  })

  it('presents a maximized panel docked at 960, not full screen', () => {
    const store = useVisibleAgentPanelStore()

    store.toggleMaximize()

    expect(store.presentation).toEqual({ kind: 'docked', width: 960 })
    expect(store.isFullscreen).toBe(false)
  })

  it('presents a panel the window cannot fit beside the workspace as an overlay', () => {
    const store = useVisibleAgentPanelStore()
    store.toggleMaximize()

    resizeWindowTo(1200)

    expect(store.presentation).toEqual({ kind: 'overlay', width: 960 })
    expect(store.isOverlay).toBe(true)
  })

  it('keeps a maximized panel maximized after it is closed and reopened', () => {
    const store = useVisibleAgentPanelStore()
    store.toggleMaximize()

    store.close('close_button')
    store.open()

    expect(store.isMaximized).toBe(true)
    expect(store.width).toBe(960)
  })
})
