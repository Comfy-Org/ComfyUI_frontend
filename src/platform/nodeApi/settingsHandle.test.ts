/**
 * Settings reach the real store, not a shape that merely type-checks.
 *
 * Three capabilities shipped this week that were unit-tested in isolation and
 * never connected to anything — `onPreview` had coverage proving the registry
 * routed a frame and none proving the app ever handed it one. So these assert
 * through `useSettingStore`, not through a mock of it.
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyApiError } from './errors'
import { createSettingsApi } from './settingsHandle'
import type { SettingsHandle } from './settingsHandle'

vi.mock('@/scripts/api', () => ({
  api: {
    getSettings: vi.fn(async () => ({})),
    storeSetting: vi.fn(async () => {}),
    addEventListener: vi.fn()
  }
}))

describe('pack settings', () => {
  let settings: SettingsHandle

  beforeEach(() => {
    setActivePinia(createPinia())
    settings = createSettingsApi()
  })

  it('does not reset a stored value when the pack re-declares', async () => {
    // Extensions re-register on every load, and a declaration that clobbered
    // the stored value would silently discard the user's choice each restart.
    settings.declare({
      id: 'KJNodes.helpPopup',
      name: 'Help popups',
      type: 'boolean',
      defaultValue: true
    })
    await settings.set('KJNodes.helpPopup', false)

    settings.declare({
      id: 'KJNodes.helpPopup',
      name: 'Help popups',
      type: 'boolean',
      defaultValue: true
    })

    expect(settings.get('KJNodes.helpPopup')).toBe(false)
  })

  it('reads back the declared default before anything is written', () => {
    settings.declare({
      id: 'KJNodes.helpPopup',
      name: 'Help popups',
      type: 'boolean',
      defaultValue: true
    })

    expect(settings.get('KJNodes.helpPopup')).toBe(true)
  })

  it('round-trips a written value', async () => {
    settings.declare({
      id: 'KJNodes.gridSize',
      name: 'Grid size',
      type: 'number',
      defaultValue: 32
    })
    await settings.set('KJNodes.gridSize', 64)

    expect(settings.get('KJNodes.gridSize')).toBe(64)
  })

  it('refuses an id that is not namespaced', () => {
    // One flat space shared with core and every other pack, and the id is what
    // the value is stored under permanently — a collision is unrecoverable.
    expect(() =>
      settings.declare({
        id: 'helpPopup',
        name: 'Help popups',
        type: 'boolean',
        defaultValue: true
      })
    ).toThrow(ComfyApiError)
  })

  it('returns undefined for a setting nobody declared', () => {
    expect(settings.get('KJNodes.neverDeclared')).toBeUndefined()
  })
})
