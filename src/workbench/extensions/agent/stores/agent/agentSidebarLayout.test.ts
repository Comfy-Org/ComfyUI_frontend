import { describe, expect, it } from 'vitest'

import {
  clampSidebarWidth,
  resolveSidebarMode,
  toggleSidebarLayout
} from './agentSidebarLayout'

describe('resolveSidebarMode', () => {
  it.for([
    { collapsed: false, drawerOpen: false, width: 1440, mode: 'expanded' },
    { collapsed: true, drawerOpen: false, width: 1440, mode: 'rail' },
    { collapsed: true, drawerOpen: true, width: 1440, mode: 'rail' },
    { collapsed: false, drawerOpen: false, width: 899, mode: 'rail' },
    { collapsed: false, drawerOpen: true, width: 899, mode: 'drawer' },
    { collapsed: true, drawerOpen: true, width: 600, mode: 'drawer' },
    { collapsed: false, drawerOpen: false, width: 900, mode: 'expanded' }
  ] as const)(
    'is $mode at $width with collapsed=$collapsed and drawerOpen=$drawerOpen',
    ({ collapsed, drawerOpen, width, mode }) => {
      expect(resolveSidebarMode({ collapsed, drawerOpen }, width)).toBe(mode)
    }
  )
})

describe('toggleSidebarLayout', () => {
  it('collapses and expands the sidebar on a wide window', () => {
    const collapsed = toggleSidebarLayout(
      { collapsed: false, drawerOpen: false },
      1440
    )
    expect(collapsed).toEqual({ collapsed: true, drawerOpen: false })
    expect(toggleSidebarLayout(collapsed, 1440)).toEqual({
      collapsed: false,
      drawerOpen: false
    })
  })

  it('opens and closes the drawer on a narrow window without touching the wide preference', () => {
    const open = toggleSidebarLayout(
      { collapsed: false, drawerOpen: false },
      800
    )
    expect(open).toEqual({ collapsed: false, drawerOpen: true })
    expect(toggleSidebarLayout(open, 800)).toEqual({
      collapsed: false,
      drawerOpen: false
    })
  })
})

describe('clampSidebarWidth', () => {
  it.for([
    { width: 312, viewport: 1440, clamped: 312 },
    { width: 220, viewport: 1440, clamped: 220 },
    { width: 219, viewport: 1440, clamped: 220 },
    { width: 480, viewport: 1440, clamped: 480 },
    { width: 481, viewport: 1440, clamped: 480 },
    { width: 470, viewport: 920, clamped: 440 },
    { width: 300, viewport: 600, clamped: 220 },
    { width: Number.NaN, viewport: 1440, clamped: 260 },
    { width: Number.POSITIVE_INFINITY, viewport: 1440, clamped: 260 }
  ])(
    'gives $clamped for $width in a window $viewport wide',
    ({ width, viewport, clamped }) => {
      expect(clampSidebarWidth(width, viewport)).toBe(clamped)
    }
  )
})
