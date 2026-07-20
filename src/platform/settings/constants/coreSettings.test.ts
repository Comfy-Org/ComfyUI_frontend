import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import type { SettingParams } from '@/platform/settings/types'
import type { Keybinding } from '@/platform/keybindings/types'

const mockSettingStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  setMany: vi.fn()
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => mockSettingStore
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isDesktop: false,
  isNightly: false
}))

vi.mock('@/locales/localeConfig', () => ({
  getDefaultLocale: () => 'en',
  SUPPORTED_LOCALE_OPTIONS: [{ value: 'en', text: 'English' }]
}))

function setting<T = unknown>(id: string): SettingParams<T> {
  const result = CORE_SETTINGS.find((item) => item.id === id)
  if (!result) throw new Error(`Missing setting ${id}`)
  return result as SettingParams<T>
}

describe('CORE_SETTINGS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.className = ''
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses compact sidebar size below the wide breakpoint', () => {
    vi.stubGlobal('innerWidth', 1200)

    const defaultValue = setting('Comfy.Sidebar.Size').defaultValue

    expect(typeof defaultValue).toBe('function')
    expect((defaultValue as () => string)()).toBe('small')
  })

  it('uses normal sidebar size above the wide breakpoint', () => {
    vi.stubGlobal('innerWidth', 1600)

    const defaultValue = setting('Comfy.Sidebar.Size').defaultValue

    expect((defaultValue as () => string)()).toBe('normal')
  })

  it('updates dependent canvas settings when navigation mode changes', async () => {
    const navigation = setting<string>('Comfy.Canvas.NavigationMode')

    await navigation.onChange?.('standard', 'legacy')
    expect(mockSettingStore.setMany).toHaveBeenLastCalledWith({
      'Comfy.Canvas.LeftMouseClickBehavior': 'select',
      'Comfy.Canvas.MouseWheelScroll': 'panning'
    })

    await navigation.onChange?.('legacy', 'standard')
    expect(mockSettingStore.setMany).toHaveBeenLastCalledWith({
      'Comfy.Canvas.LeftMouseClickBehavior': 'panning',
      'Comfy.Canvas.MouseWheelScroll': 'zoom'
    })
  })

  it('does not update dependent canvas settings on initial navigation setup', async () => {
    await setting<string>('Comfy.Canvas.NavigationMode').onChange?.('standard')

    expect(mockSettingStore.setMany).not.toHaveBeenCalled()
  })

  it('keeps preset navigation mode when left-click behavior still matches it', async () => {
    mockSettingStore.get.mockReturnValue('standard')

    await setting<string>('Comfy.Canvas.LeftMouseClickBehavior').onChange?.(
      'select'
    )

    expect(mockSettingStore.set).not.toHaveBeenCalled()
  })

  it('marks navigation mode custom when left-click behavior diverges from the preset', async () => {
    mockSettingStore.get.mockReturnValue('standard')

    await setting<string>('Comfy.Canvas.LeftMouseClickBehavior').onChange?.(
      'panning'
    )

    expect(mockSettingStore.set).toHaveBeenCalledWith(
      'Comfy.Canvas.NavigationMode',
      'custom'
    )
  })

  it('does not rewrite custom navigation mode from left-click behavior', async () => {
    mockSettingStore.get.mockReturnValue('custom')

    await setting<string>('Comfy.Canvas.LeftMouseClickBehavior').onChange?.(
      'select'
    )

    expect(mockSettingStore.set).not.toHaveBeenCalled()
  })

  it('keeps preset navigation mode when wheel behavior still matches it', async () => {
    mockSettingStore.get.mockReturnValue('legacy')

    await setting<string>('Comfy.Canvas.MouseWheelScroll').onChange?.('zoom')

    expect(mockSettingStore.set).not.toHaveBeenCalled()
  })

  it('marks navigation mode custom when wheel behavior diverges from the preset', async () => {
    mockSettingStore.get.mockReturnValue('legacy')

    await setting<string>('Comfy.Canvas.MouseWheelScroll').onChange?.('panning')

    expect(mockSettingStore.set).toHaveBeenCalledWith(
      'Comfy.Canvas.NavigationMode',
      'custom'
    )
  })

  it('toggles the dev-mode API save button when present', () => {
    const button = document.createElement('button')
    button.id = 'comfy-dev-save-api-button'
    document.body.append(button)

    const devMode = setting<boolean>('Comfy.DevMode')
    devMode.onChange?.(true)
    expect(button.style.display).toBe('flex')

    devMode.onChange?.(false)
    expect(button.style.display).toBe('none')
  })

  it('ignores the dev-mode button handler when the element is absent', () => {
    expect(document.getElementById('comfy-dev-save-api-button')).toBeNull()

    expect(() =>
      setting<boolean>('Comfy.DevMode').onChange?.(true)
    ).not.toThrow()
  })

  it('toggles the disabled animations body class', () => {
    const animations = setting<boolean>('Comfy.Appearance.DisableAnimations')

    animations.onChange?.(true)
    expect(document.body.classList.contains('disable-animations')).toBe(true)

    animations.onChange?.(false)
    expect(document.body.classList.contains('disable-animations')).toBe(false)
  })

  it('migrates deprecated menu and workflow tab values', () => {
    expect(
      setting<string>('Comfy.UseNewMenu').migrateDeprecatedValue?.('Floating')
    ).toBe('Top')
    expect(
      setting<string>('Comfy.UseNewMenu').migrateDeprecatedValue?.('Bottom')
    ).toBe('Top')
    expect(
      setting<string>('Comfy.UseNewMenu').migrateDeprecatedValue?.('Top')
    ).toBe('Top')
    expect(
      setting<string>(
        'Comfy.Workflow.WorkflowTabsPosition'
      ).migrateDeprecatedValue?.('Topbar (2nd-row)')
    ).toBe('Topbar')
  })

  it('migrates graph-canvas keybinding target selectors', () => {
    const bindings = [
      {
        combo: { key: 'a' },
        commandId: 'test.command',
        targetSelector: '#graph-canvas'
      },
      {
        combo: { key: 'b' },
        commandId: 'other.command',
        targetSelector: '#other'
      }
    ]

    const migrated =
      setting<Keybinding[]>(
        'Comfy.Keybinding.UnsetBindings'
      ).migrateDeprecatedValue?.(bindings) ?? []

    expect(migrated[0].targetElementId).toBe('graph-canvas-container')
    expect(migrated[1].targetElementId).toBeUndefined()
  })
})
