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
import { nextTick } from 'vue'

import { useSettingStore } from '@/platform/settings/settingStore'

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

  it('writes a core setting the pack did not declare', async () => {
    await settings.set(
      'Comfy.Canvas.BackgroundImage',
      '/api/view?filename=background.png&type=output'
    )

    expect(settings.get('Comfy.Canvas.BackgroundImage')).toBe(
      '/api/view?filename=background.png&type=output'
    )
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

  it('keeps a stored value that is not its own label', () => {
    // Several packs store a semantic number and show words for it, then
    // compare numerically (`showlinks > 0`). A string-only option list would
    // silently re-type every user's saved choice.
    settings.declare({
      id: 'UE.showlinks',
      name: 'Show links',
      type: 'combo',
      defaultValue: 0,
      options: [
        { value: 0, label: 'off' },
        { value: 1, label: 'selected' },
        { value: 2, label: 'all' }
      ]
    })

    expect(settings.get('UE.showlinks')).toBe(0)
  })

  it('passes slider bounds through', () => {
    settings.declare({
      id: 'MyPack.size',
      name: 'Size',
      type: 'slider',
      defaultValue: 5,
      attrs: { min: 1, max: 10, step: 1 }
    })

    expect(settings.get('MyPack.size')).toBe(5)
  })
})

describe('onChange', () => {
  it('watches a core setting the pack never declared', async () => {
    // `declare`'s own onChange only fires for settings the pack owns, so a
    // pack reacting to a core preference had nothing to observe.
    const settings = createSettingsApi()
    const seen: unknown[] = []
    const stop = settings.onChange('Comfy.UseNewMenu', (v) => seen.push(v))

    await useSettingStore().set('Comfy.UseNewMenu' as never, 'Top' as never)
    await nextTick()

    expect(seen).toEqual(['Top'])
    stop()
  })

  it('stops watching once unsubscribed', async () => {
    const settings = createSettingsApi()
    const seen: unknown[] = []
    const stop = settings.onChange('Comfy.UseNewMenu', (v) => seen.push(v))

    stop()
    await useSettingStore().set('Comfy.UseNewMenu' as never, 'Bottom' as never)
    await nextTick()

    expect(seen).toEqual([])
  })
})

describe('setting control types', () => {
  it('declares a colour setting as a colour, not a text field', () => {
    // Packs fell back to a text box the user pasted six hex digits into,
    // because the published union named only five of core's types.
    setActivePinia(createPinia())
    const settings = createSettingsApi()

    settings.declare({
      id: 'MyPack.accent',
      name: 'Accent',
      type: 'color',
      defaultValue: '#336699'
    })

    expect(useSettingStore().settingsById['MyPack.accent']?.type).toBe('color')
  })

  it('declares an image setting, which core renders as a file picker', () => {
    setActivePinia(createPinia())
    createSettingsApi().declare({
      id: 'MyPack.logo',
      name: 'Logo',
      type: 'image',
      defaultValue: ''
    })

    expect(useSettingStore().settingsById['MyPack.logo']?.type).toBe('image')
  })

  it('declares a secret as a masked password control', () => {
    setActivePinia(createPinia())
    createSettingsApi().declare({
      id: 'MyPack.apiKey',
      name: 'API key',
      type: 'password',
      defaultValue: ''
    })

    expect(useSettingStore().settingsById['MyPack.apiKey']?.type).toBe(
      'password'
    )
  })
})
