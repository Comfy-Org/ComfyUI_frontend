import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'
import { useDialogStore } from '@/stores/dialogStore'
import { useSystemStatsStore } from '@/stores/systemStatsStore'
import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import { useManagerDialog } from '@/workbench/extensions/manager/composables/useManagerDialog'
import {
  ManagerUIState,
  __resetIncompatibleToastGuard
} from '@/workbench/extensions/manager/composables/useManagerState'

vi.mock(import('@/i18n'))
vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

const systemStats = (argv: string[]) => ({
  system: {
    os: 'Test OS',
    python_version: '3.10',
    embedded_python: false,
    comfyui_version: '1.0.0',
    pytorch_version: '2.0.0',
    argv,
    ram_total: 16000000000,
    ram_free: 8000000000
  },
  devices: []
})

/** Drives the real useManagerState() into the given state via its inputs. */
function setManagerState(state: ManagerUIState) {
  const argv = ['main.py']
  if (state !== ManagerUIState.DISABLED) argv.push('--enable-manager')
  if (state === ManagerUIState.LEGACY_UI)
    argv.push('--enable-manager-legacy-ui')
  useSystemStatsStore().$patch({
    systemStats: systemStats(argv),
    isInitialized: true
  })
  vi.spyOn(api, 'getClientFeatureFlags').mockReturnValue({
    supports_manager_v4_ui: true
  })
  vi.spyOn(api, 'getServerFeature').mockImplementation((name: string) => {
    if (name === 'extension.manager.supports_v4') return true
    if (name === 'extension.manager.supports_csrf_post')
      return state !== ManagerUIState.INCOMPATIBLE
    return undefined
  })
}

const incompatibleToast = expect.objectContaining({
  description: 'manager.incompatibleVersion.message',
  duration: 15000,
  kind: 'warning',
  title: 'manager.incompatibleVersion.title'
})

const legacyErrorToast = expect.objectContaining({
  description: 'manager.legacyMenuNotAvailable',
  kind: 'error',
  title: 'g.error'
})

describe('useManagerDialog', () => {
  it('show() opens the global-manager dialog', () => {
    useManagerDialog().show()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('global-manager')
  })

  it('show(initialTab) forwards initialTab to ManagerDialog props', () => {
    useManagerDialog().show(ManagerTab.UpdateAvailable)
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.props).toMatchObject({ initialTab: ManagerTab.UpdateAvailable })
  })

  it('show(initialTab, initialPackId) forwards initialPackId to ManagerDialog props', () => {
    useManagerDialog().show(ManagerTab.All, 'pack-123')
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.props).toMatchObject({ initialPackId: 'pack-123' })
  })

  it('hide() closes the global-manager dialog', () => {
    useManagerDialog().hide()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'global-manager'
    })
  })

  describe('openManager', () => {
    beforeEach(() => {
      __resetIncompatibleToastGuard()
    })

    it('repeated event-time opens do not react to later manager state changes', async () => {
      setManagerState(ManagerUIState.DISABLED)
      await useManagerDialog().openManager()
      await useManagerDialog().openManager()

      setManagerState(ManagerUIState.INCOMPATIBLE)
      useSystemStatsStore().systemStats = systemStats([
        'main.py',
        '--enable-manager'
      ])
      await nextTick()

      expect(useToast().toasts).toEqual([])
    })

    it('DISABLED redirects to the extension settings panel', async () => {
      setManagerState(ManagerUIState.DISABLED)
      await useManagerDialog().openManager()
      expect(useSettingsDialog().show).toHaveBeenCalledWith('extension')
      expect(useDialogStore().showDialog).not.toHaveBeenCalled()
    })

    it('INCOMPATIBLE re-emits the upgrade toast on every call without a settings redirect', async () => {
      setManagerState(ManagerUIState.INCOMPATIBLE)
      await useManagerDialog().openManager()
      expect(useToast().toasts).toEqual([incompatibleToast])
      await useManagerDialog().openManager()
      const { toasts } = useToast()
      expect(toasts).toEqual([incompatibleToast, incompatibleToast])
      expect(useSettingsDialog().show).not.toHaveBeenCalled()
      expect(useDialogStore().showDialog).not.toHaveBeenCalled()
    })

    it('NEW_UI shows the dialog with the requested tab and pack', async () => {
      setManagerState(ManagerUIState.NEW_UI)
      await useManagerDialog().openManager({
        initialTab: ManagerTab.Missing,
        initialPackId: 'pack-1'
      })
      const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
      expect(args.props).toMatchObject({
        initialTab: ManagerTab.Missing,
        initialPackId: 'pack-1'
      })
    })

    it('NEW_UI with isLegacyOnly shows an error toast instead of the dialog', async () => {
      setManagerState(ManagerUIState.NEW_UI)
      await useManagerDialog().openManager({ isLegacyOnly: true })
      expect(useToast().toasts).toEqual([legacyErrorToast])
      expect(useDialogStore().showDialog).not.toHaveBeenCalled()
    })

    it('LEGACY_UI executes the given command, defaulting to the manager menu toggle', async () => {
      setManagerState(ManagerUIState.LEGACY_UI)
      vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
      await useManagerDialog().openManager()
      await useManagerDialog().openManager({ legacyCommand: 'Custom.Command' })
      expect(
        vi.mocked(useCommandStore().execute).mock.calls.map(([id]) => id)
      ).toEqual(['Comfy.Manager.Menu.ToggleVisibility', 'Custom.Command'])
    })

    it.for([
      { showToastOnLegacyError: undefined, toasts: 1, settings: 0 },
      { showToastOnLegacyError: false, toasts: 0, settings: 1 }
    ])(
      'LEGACY_UI command failure with showToastOnLegacyError=$showToastOnLegacyError',
      async ({ showToastOnLegacyError, toasts, settings }) => {
        setManagerState(ManagerUIState.LEGACY_UI)
        vi.mocked(useCommandStore().execute).mockRejectedValue(
          new Error('missing')
        )
        await useManagerDialog().openManager({ showToastOnLegacyError })
        expect(useToast().toasts).toHaveLength(toasts)
        expect(useSettingsDialog().show).toHaveBeenCalledTimes(settings)
      }
    )
  })
})
