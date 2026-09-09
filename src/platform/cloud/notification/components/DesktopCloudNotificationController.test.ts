import { render } from '@testing-library/vue'
import { useAsyncState } from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import DesktopCloudNotificationController from './DesktopCloudNotificationController.vue'

const settingState = {
  shown: false
}

const settingStore = {
  get error(): unknown {
    return undefined
  },
  load: vi.fn<() => Promise<void>>(),
  get: vi.fn((key: string) =>
    key === 'Comfy.Desktop.CloudNotificationShown'
      ? settingState.shown
      : undefined
  ),
  set: vi.fn(async (_key: string, value: boolean) => {
    settingState.shown = value
  })
}

const dialogService = {
  showCloudNotification: vi.fn<() => Promise<void>>()
}

const electron = {
  getPlatform: vi.fn(() => 'darwin')
}

const errorReporter = vi.hoisted(() => vi.fn())

vi.mock(import('@/platform/distribution/types'), () => ({
  isDesktop: true
}))

vi.mock<unknown>(import('@/platform/settings/settingStore'), () => ({
  useSettingStore: () => settingStore
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
    settingState.shown = false
    electron.getPlatform.mockReturnValue('darwin')
    settingStore.load.mockResolvedValue(undefined)
    settingStore.set.mockImplementation(
      async (_key: string, value: boolean) => {
        settingState.shown = value
      }
    )
    dialogService.showCloudNotification.mockResolvedValue(undefined)
  })

  it('waits for settings to load before deciding whether to show the notification', async () => {
    const loadSettings = createDeferred()
    settingStore.load.mockImplementation(() => loadSettings.promise)

    const { unmount } = render(DesktopCloudNotificationController)
    await nextTick()

    settingState.shown = true
    loadSettings.resolve()

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2000)

    expect(dialogService.showCloudNotification).not.toHaveBeenCalled()

    unmount()
  })

  it('does not schedule or show the notification after unmounting before settings load resolves', async () => {
    const loadSettings = createDeferred()
    settingStore.load.mockImplementation(() => loadSettings.promise)

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
    expect(settingStore.set.mock.invocationCallOrder[0]).toBeLessThan(
      dialogService.showCloudNotification.mock.invocationCallOrder[0]
    )

    dialogOpen.resolve()
    await vi.advanceTimersByTimeAsync(0)

    unmount()
  })

  it('reports a settings load failure without scheduling the notification', async () => {
    const error = new Error('load failed')
    const settingsLoad = useAsyncState(() => Promise.reject(error), undefined, {
      immediate: false
    })
    settingStore.load.mockImplementation(async () => {
      await settingsLoad.execute()
    })
    vi.spyOn(settingStore, 'error', 'get').mockImplementation(
      () => settingsLoad.error.value
    )

    const { unmount } = render(DesktopCloudNotificationController)
    await vi.advanceTimersByTimeAsync(0)

    expect(errorReporter).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        errorType: 'cloud_notification_settings_load_failed',
        tags: expect.objectContaining({
          failure_kind: 'caught_unexpected',
          feature_area: 'cloud',
          operation: 'load',
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
    await vi.advanceTimersByTimeAsync(2000)

    expect(settingStore.set).not.toHaveBeenCalled()
    expect(dialogService.showCloudNotification).not.toHaveBeenCalled()

    unmount()
  })

  it('reports an initial save failure, resets state, and never opens the dialog', async () => {
    const error = new Error('save failed')
    settingStore.set.mockRejectedValueOnce(error)

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
      dialogService.showCloudNotification.mockRejectedValue(initialError)
      settingStore.set.mockImplementation(
        async (_key: string, value: boolean) => {
          if (!value) throw resetError
          if (failure === 'save') throw initialError
          settingState.shown = value
        }
      )

      const { unmount } = render(DesktopCloudNotificationController)
      await vi.advanceTimersByTimeAsync(2000)

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
