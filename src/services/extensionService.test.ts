import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { AuthUserInfo } from '@/types/authTypes'
import type { ComfyExtension } from '@/types/comfy'
import { useExtensionService } from './extensionService'

const mockLoadDisabledExtensionNames = vi.hoisted(() => vi.fn())
const mockRegisterExtension = vi.hoisted(() => vi.fn())
const mockCaptureCoreExtensions = vi.hoisted(() => vi.fn())
const mockEnabledExtensions = vi.hoisted(() => ({
  value: [] as ComfyExtension[]
}))
vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({
    loadDisabledExtensionNames: mockLoadDisabledExtensionNames,
    registerExtension: mockRegisterExtension,
    captureCoreExtensions: mockCaptureCoreExtensions,
    get enabledExtensions() {
      return mockEnabledExtensions.value
    }
  })
}))

const mockGetSetting = vi.hoisted(() => vi.fn())
const mockAddSetting = vi.hoisted(() => vi.fn())
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockGetSetting,
    addSetting: mockAddSetting
  })
}))

const mockAddDefaultKeybinding = vi.hoisted(() => vi.fn())
vi.mock('@/platform/keybindings/keybindingStore', () => ({
  useKeybindingStore: () => ({
    addDefaultKeybinding: mockAddDefaultKeybinding
  })
}))

vi.mock('@/platform/keybindings/keybinding', () => ({
  KeybindingImpl: class KeybindingImpl {
    constructor(readonly source: unknown) {}
  }
}))

const mockLoadExtensionCommands = vi.hoisted(() => vi.fn())
vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    loadExtensionCommands: mockLoadExtensionCommands
  })
}))

const mockLoadExtensionMenuCommands = vi.hoisted(() => vi.fn())
vi.mock('@/stores/menuItemStore', () => ({
  useMenuItemStore: () => ({
    loadExtensionMenuCommands: mockLoadExtensionMenuCommands
  })
}))

const mockRegisterBottomPanelTabs = vi.hoisted(() => vi.fn())
vi.mock('@/stores/workspace/bottomPanelStore', () => ({
  useBottomPanelStore: () => ({
    registerExtensionBottomPanelTabs: mockRegisterBottomPanelTabs
  })
}))

const mockRegisterCustomWidgets = vi.hoisted(() => vi.fn())
vi.mock('@/stores/widgetStore', () => ({
  useWidgetStore: () => ({
    registerCustomWidgets: mockRegisterCustomWidgets
  })
}))

const mockToastErrorHandler = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandling:
      <Args extends unknown[], Return>(fn: (...args: Args) => Return) =>
      (...args: Args) =>
        fn(...args),
    wrapWithErrorHandlingAsync:
      <Args extends unknown[], Return>(
        fn: (...args: Args) => Return | Promise<Return>,
        handler: (error: unknown) => void
      ) =>
      async (...args: Args) => {
        try {
          return await fn(...args)
        } catch (error) {
          handler(error)
        }
      },
    toastErrorHandler: mockToastErrorHandler
  })
}))

const mockUserResolvedCallbacks = vi.hoisted(() => ({
  values: [] as Array<(user: AuthUserInfo) => void>
}))
const mockTokenRefreshedCallbacks = vi.hoisted(() => ({
  values: [] as Array<() => void>
}))
const mockUserLogoutCallbacks = vi.hoisted(() => ({
  values: [] as Array<() => void>
}))
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    onUserResolved: (callback: (user: AuthUserInfo) => void) => {
      mockUserResolvedCallbacks.values.push(callback)
    },
    onTokenRefreshed: (callback: () => void) => {
      mockTokenRefreshedCallbacks.values.push(callback)
    },
    onUserLogout: (callback: () => void) => {
      mockUserLogoutCallbacks.values.push(callback)
    }
  })
}))

const mockSetCurrentExtension = vi.hoisted(() => vi.fn())
vi.mock('@/lib/litegraph/src/contextMenuCompat', () => ({
  legacyMenuCompat: {
    setCurrentExtension: mockSetCurrentExtension
  }
}))

const mockApp = vi.hoisted(() => ({ value: { name: 'app' } }))
vi.mock('@/scripts/app', () => ({
  app: mockApp.value
}))

vi.mock('@/scripts/api', () => ({
  api: {
    getExtensions: vi.fn(),
    fileURL: vi.fn((path: string) => path)
  }
}))

describe('useExtensionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnabledExtensions.value = []
    mockUserResolvedCallbacks.values = []
    mockTokenRefreshedCallbacks.values = []
    mockUserLogoutCallbacks.values = []
  })

  it('registers extension contributions across stores', async () => {
    const widgets = { CustomWidget: vi.fn() }
    const extension = fromAny<ComfyExtension, unknown>({
      name: 'registration-extension',
      keybindings: [{ commandId: 'command.one', combo: { key: 'K' } }],
      commands: [{ id: 'command.one', label: 'Command One' }],
      menuCommands: [{ path: ['File'], commands: ['command.one'] }],
      settings: [{ id: 'setting.one', name: 'Setting One' }],
      bottomPanelTabs: [{ id: 'tab.one', title: 'Tab One' }],
      getCustomWidgets: vi.fn().mockResolvedValue(widgets)
    })
    const service = useExtensionService()

    service.registerExtension(extension)

    expect(mockRegisterExtension).toHaveBeenCalledWith(extension)
    expect(mockAddDefaultKeybinding).toHaveBeenCalledWith(
      expect.objectContaining({
        source: { commandId: 'command.one', combo: { key: 'K' } }
      })
    )
    expect(mockLoadExtensionCommands).toHaveBeenCalledWith(extension)
    expect(mockLoadExtensionMenuCommands).toHaveBeenCalledWith(extension)
    expect(mockAddSetting.mock.calls[0][0]).toEqual({
      id: 'setting.one',
      name: 'Setting One'
    })
    expect(mockRegisterBottomPanelTabs).toHaveBeenCalledWith(extension)
    await vi.waitFor(() => {
      expect(mockRegisterCustomWidgets).toHaveBeenCalledWith(widgets)
    })
  })

  it('invokes auth lifecycle hooks through registered callbacks', async () => {
    const onAuthUserResolved = vi.fn()
    const onAuthTokenRefreshed = vi.fn()
    const onAuthUserLogout = vi.fn()
    const extension = fromAny<ComfyExtension, unknown>({
      name: 'auth-extension',
      onAuthUserResolved,
      onAuthTokenRefreshed,
      onAuthUserLogout
    })
    const user = fromAny<AuthUserInfo, unknown>({ id: 'user-1' })
    const service = useExtensionService()

    service.registerExtension(extension)
    mockUserResolvedCallbacks.values[0](user)
    mockTokenRefreshedCallbacks.values[0]()
    mockUserLogoutCallbacks.values[0]()

    await vi.waitFor(() => {
      expect(onAuthUserResolved).toHaveBeenCalledWith(user, mockApp.value)
      expect(onAuthTokenRefreshed).toHaveBeenCalled()
      expect(onAuthUserLogout).toHaveBeenCalled()
    })
  })

  it('reports auth hook errors through the toast handler', async () => {
    const error = new Error('auth failed')
    const extension = fromAny<ComfyExtension, unknown>({
      name: 'failing-auth-extension',
      onAuthUserResolved: vi.fn(() => {
        throw error
      })
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const service = useExtensionService()

    service.registerExtension(extension)
    mockUserResolvedCallbacks.values[0](
      fromAny<AuthUserInfo, unknown>({ id: 'user-1' })
    )

    await vi.waitFor(() => {
      expect(mockToastErrorHandler).toHaveBeenCalledWith(error)
    })
    expect(consoleError).toHaveBeenCalledWith(
      '[Extension Auth Hook Error]',
      expect.objectContaining({
        extension: 'failing-auth-extension',
        hook: 'onAuthUserResolved',
        error
      })
    )
    consoleError.mockRestore()
  })

  it('invokes synchronous extension methods and keeps failures isolated', () => {
    const getSelectionToolboxCommands = vi.fn(() => ['command.one'])
    const failingGetSelectionToolboxCommands = vi.fn(() => {
      throw new Error('menu failed')
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockEnabledExtensions.value = [
      fromAny<ComfyExtension, unknown>({
        name: 'working-extension',
        getSelectionToolboxCommands
      }),
      fromAny<ComfyExtension, unknown>({
        name: 'non-function-extension',
        getSelectionToolboxCommands: ['not callable']
      }),
      fromAny<ComfyExtension, unknown>({
        name: 'failing-extension',
        getSelectionToolboxCommands: failingGetSelectionToolboxCommands
      }),
      { name: 'missing-method-extension' }
    ]
    const service = useExtensionService()

    const results = service.invokeExtensions(
      'getSelectionToolboxCommands',
      fromAny<LGraphNode, unknown>({ id: 1 })
    )

    expect(results).toEqual([['command.one']])
    expect(getSelectionToolboxCommands).toHaveBeenCalledWith(
      fromAny<LGraphNode, unknown>({ id: 1 }),
      mockApp.value
    )
    expect(consoleError).toHaveBeenCalledWith(
      "Error calling extension 'failing-extension' method 'getSelectionToolboxCommands'",
      expect.objectContaining({ error: expect.any(Error) }),
      expect.objectContaining({
        extension: expect.objectContaining({ name: 'failing-extension' })
      }),
      expect.objectContaining({
        args: [fromAny<LGraphNode, unknown>({ id: 1 })]
      })
    )
    consoleError.mockRestore()
  })

  it('tracks current extension around async setup callbacks', async () => {
    const setup = vi.fn().mockResolvedValue('setup-result')
    const failingSetup = vi.fn().mockRejectedValue(new Error('setup failed'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockEnabledExtensions.value = [
      fromAny<ComfyExtension, unknown>({
        name: 'setup-extension',
        setup
      }),
      fromAny<ComfyExtension, unknown>({
        name: 'non-function-extension',
        setup: true
      }),
      fromAny<ComfyExtension, unknown>({
        name: 'failing-setup-extension',
        setup: failingSetup
      }),
      { name: 'missing-method-extension' }
    ]
    const service = useExtensionService()

    const results = await service.invokeExtensionsAsync('setup')

    expect(results).toEqual(['setup-result', undefined, undefined, undefined])
    expect(mockSetCurrentExtension.mock.calls.map((call) => call[0])).toEqual([
      'setup-extension',
      'failing-setup-extension',
      null,
      null
    ])
    expect(consoleError).toHaveBeenCalledWith(
      "Error calling extension 'failing-setup-extension' method 'setup'",
      expect.objectContaining({ error: expect.any(Error) }),
      expect.objectContaining({
        extension: expect.objectContaining({ name: 'failing-setup-extension' })
      }),
      expect.objectContaining({ args: [] })
    )
    consoleError.mockRestore()
  })
})
