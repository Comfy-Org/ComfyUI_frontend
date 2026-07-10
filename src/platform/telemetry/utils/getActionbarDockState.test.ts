import { beforeEach, describe, expect, it } from 'vitest'

import { getActionbarDockState } from './getActionbarDockState'

describe('getActionbarDockState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns docked when no preference is stored', () => {
    expect(getActionbarDockState()).toBe('docked')
  })

  it('returns docked when the stored preference is true', () => {
    localStorage.setItem('Comfy.MenuPosition.Docked', 'true')
    expect(getActionbarDockState()).toBe('docked')
  })

  it('returns floating when the stored preference is false', () => {
    localStorage.setItem('Comfy.MenuPosition.Docked', 'false')
    expect(getActionbarDockState()).toBe('floating')
  })

  it('returns docked when stored state is top', () => {
    localStorage.setItem('Comfy.MenuPosition.DockState', 'top')
    expect(getActionbarDockState()).toBe('docked')
  })

  it('returns docked when stored state is bottom', () => {
    localStorage.setItem('Comfy.MenuPosition.DockState', 'bottom')
    expect(getActionbarDockState()).toBe('docked')
  })

  it('returns floating when stored state is floating', () => {
    localStorage.setItem('Comfy.MenuPosition.DockState', 'floating')
    expect(getActionbarDockState()).toBe('floating')
  })
})
