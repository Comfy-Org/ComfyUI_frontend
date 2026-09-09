import type * as DistributionModule from '@/platform/distribution/types'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useSettingStore } from '@/platform/settings/settingStore'

import DesktopCloudNotificationController from './DesktopCloudNotificationController.vue'

let settingStore: ReturnType<typeof useSettingStore>

const dialogService = {
  showCloudNotification: vi.fn<() => Promise<void>>()
}

const electron = {
  getPlatform: vi.fn(() => 'darwin')
}

const errorReporter = vi.hoisted(() => vi.fn())

vi.mock(import('@/platform/distribution/types'), async (importOriginal) => ({
  ...(await importOriginal<typeof DistributionModule>()),
  isDesktop: true
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: errorReporter
}))

vi.mock<unknown>(import('@/services/dialogService'), () => ({
  useDialogService: () => dialogService
}))

vi.mock<unknown>(import('@/utils/envUtil'), () => ({
  electronAPI: () => electron
}))

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

describe('DesktopCloudNotificationController', () => {
  beforeEach(() => {
    settingStore = useSettingStore()
    settingStore.settingValues['Comfy.Desktop.CloudNotificationShown'] = false
    electron.getPlatform.mockReturnValue('darwin')
    vi.mocked(settingStore.load).mockResolvedValue(undefined)
    vi.mocked(settingStore.set).mockImplementation(
      async (_key: string, value: boolean) => {
        settingStore.settingValues['Comfy.Desktop.CloudNotificationShown'] =
          value
      }
    )
    dialogService.showCloudNotification.mockResolvedValue(undefined)
  })

  it('waits for settings to load before deciding whether to show the notification', async () => {
    const loadSettings = createDeferred()
    vi.mocked(settingStore.load).mockImplementation(() => loadSettings.promise)

    const { unmount } = render(DesktopCloudNotificationController)
    await nextTick()

    settingStore.settingValues['Comfy.Desktop.CloudNotificationShown'] = true
    loadSettings.resolve()

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2000)

    expect(dialogService.showCloudNotification).not.toHaveBeenCalled()

    unmount()
  })

  it('does not schedule or show the notification after unmounting before settings load resolves', async () => {
    const loadSettings = createDeferred()
    vi.mocked(settingStore.load).mockImplementation(() => loadSettings.promise)

    const { unmount } = render(DesktopCloudNotificationController)
    await nextTick()

    unmount()
    loadSettings.resolve()

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2000)

    expect(settingStore.set).not.toHaveBeenCalled()
    expect(dialogService.showCloudNotification).not.toHaveBeenCalled()
  })

  it('marks the notification as shown before awaiting dialog close', async () => {
    const dialogOpen = createDeferred()
    dialogService.showCloudNotification.mockImplementation(
      () => dialogOpen.promise
    )

    const { unmount } = render(DesktopCloudNotificationController)

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2000)

    expect(settingStore.set).toHaveBeenCalledWith(
      'Comfy.Desktop.CloudNotificationShown',
      true
    )
    expect(
      vi.mocked(settingStore.set).mock.invocationCallOrder[0]
    ).toBeLessThan(
      dialogService.showCloudNotification.mock.invocationCallOrder[0]
    )

    dialogOpen.resolve()
    await vi.advanceTimersByTimeAsync(0)

    unmount()
  })

  it('resets the shown state when unmounted before the initial save completes', async () => {
    const saveSettings = createDeferred()
    vi.mocked(settingStore.set).mockImplementationOnce(async (_key, value) => {
      settingStore.settingValues['Comfy.Desktop.CloudNotificationShown'] = value
      await saveSettings.promise
    })

    const { unmount } = render(DesktopCloudNotificationController)
    await vi.advanceTimersByTimeAsync(2000)

    expect(
      settingStore.settingValues['Comfy.Desktop.CloudNotificationShown']
    ).toBe(true)
    unmount()
    saveSettings.resolve()
    await vi.advanceTimersByTimeAsync(0)

    expect(settingStore.set).toHaveBeenLastCalledWith(
      'Comfy.Desktop.CloudNotificationShown',
      false
    )
    expect(
      settingStore.settingValues['Comfy.Desktop.CloudNotificationShown']
    ).toBe(false)
    expect(dialogService.showCloudNotification).not.toHaveBeenCalled()
  })

  it('aborts without reporting a stored settings error', async () => {
    vi.spyOn(settingStore, 'error', 'get').mockReturnValue(
      new Error('load failed')
    )

    const { unmount } = render(DesktopCloudNotificationController)
    await vi.advanceTimersByTimeAsync(2000)

    expect(errorReporter).not.toHaveBeenCalled()
    expect(settingStore.set).not.toHaveBeenCalled()
    expect(dialogService.showCloudNotification).not.toHaveBeenCalled()

    unmount()
  })

  it('reports an initial save failure, resets state, and never opens the dialog', async () => {
    const error = new Error('save failed')
    vi.mocked(settingStore.set).mockRejectedValueOnce(error)

    const { unmount } = render(DesktopCloudNotificationController)
    await vi.advanceTimersByTimeAsync(2000)

    expect(errorReporter).toHaveBeenCalledExactlyOnceWith(
      error,
      expect.objectContaining({
        errorType: 'cloud_notification_state_save_failed',
        tags: expect.objectContaining({
          failure_kind: 'caught_unexpected',
          feature_area: 'cloud',
          operation: 'save',
          outcome: 'failed',
          assert_mode: 'soft'
        }),
        context: expect.objectContaining({
          platform: 'darwin',
          is_disposed: false
        }),
        level: 'error'
      })
    )
    expect(settingStore.set).toHaveBeenNthCalledWith(
      1,
      'Comfy.Desktop.CloudNotificationShown',
      true
    )
    expect(settingStore.set).toHaveBeenLastCalledWith(
      'Comfy.Desktop.CloudNotificationShown',
      false
    )
    expect(dialogService.showCloudNotification).not.toHaveBeenCalled()

    unmount()
  })

  it('reports a notification failure and resets its shown state', async () => {
    const error = new Error('show failed')
    dialogService.showCloudNotification.mockRejectedValue(error)

    const { unmount } = render(DesktopCloudNotificationController)
    await vi.advanceTimersByTimeAsync(2000)

    expect(errorReporter).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        errorType: 'cloud_notification_show_failed',
        tags: expect.objectContaining({
          failure_kind: 'caught_unexpected',
          feature_area: 'cloud',
          operation: 'render',
          outcome: 'failed',
          assert_mode: 'soft'
        }),
        context: expect.objectContaining({
          platform: 'darwin',
          is_disposed: false
        }),
        level: 'error'
      })
    )
    expect(settingStore.set).toHaveBeenLastCalledWith(
      'Comfy.Desktop.CloudNotificationShown',
      false
    )

    unmount()
  })

  it.for(['save', 'display'])(
    'reports a reset failure after a %s failure',
    async (failure) => {
      const initialError = new Error('initial failure')
      const resetError = new Error('reset failed')
      if (failure === 'display') {
        dialogService.showCloudNotification.mockRejectedValue(initialError)
      }
      vi.mocked(settingStore.set).mockImplementation(
        async (_key: string, value: boolean) => {
          if (!value) throw resetError
          if (failure === 'save') throw initialError
          settingStore.settingValues['Comfy.Desktop.CloudNotificationShown'] =
            value
        }
      )

      const { unmount } = render(DesktopCloudNotificationController)
      await vi.advanceTimersByTimeAsync(2000)

      expect(errorReporter).toHaveBeenNthCalledWith(
        1,
        initialError,
        expect.objectContaining({
          errorType:
            failure === 'save'
              ? 'cloud_notification_state_save_failed'
              : 'cloud_notification_show_failed'
        })
      )
      expect(errorReporter).toHaveBeenNthCalledWith(
        2,
        resetError,
        expect.objectContaining({
          errorType: 'cloud_notification_state_reset_failed',
          tags: expect.objectContaining({
            failure_kind: 'caught_unexpected',
            feature_area: 'cloud',
            operation: 'save',
            outcome: 'failed',
            assert_mode: 'soft'
          }),
          context: expect.objectContaining({
            platform: 'darwin',
            is_disposed: false
          }),
          level: 'error'
        })
      )

      unmount()
    }
  )
})
