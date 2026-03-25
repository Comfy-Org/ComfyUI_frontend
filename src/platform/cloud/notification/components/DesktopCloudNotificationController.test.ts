import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import DesktopCloudNotificationController from './DesktopCloudNotificationController.vue'

const settingState = {
  shown: false
}

const settingStore = {
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

vi.mock('@/platform/distribution/types', () => ({
  isDesktop: true
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => settingStore
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => dialogService
}))

vi.mock('@/utils/envUtil', () => ({
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
    vi.useFakeTimers()
    vi.clearAllMocks()

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

  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits for settings to load before deciding whether to show the notification', async () => {
    const loadSettings = createDeferred()
    settingStore.load.mockImplementation(() => loadSettings.promise)

    const wrapper = mount(DesktopCloudNotificationController)
    await nextTick()

    settingState.shown = true
    loadSettings.resolve()

    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)

    expect(dialogService.showCloudNotification).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('does not schedule or show the notification after unmounting before settings load resolves', async () => {
    const loadSettings = createDeferred()
    settingStore.load.mockImplementation(() => loadSettings.promise)

    const wrapper = mount(DesktopCloudNotificationController)
    await nextTick()

    wrapper.unmount()
    loadSettings.resolve()

    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)

    expect(settingStore.set).not.toHaveBeenCalled()
    expect(dialogService.showCloudNotification).not.toHaveBeenCalled()
  })

  it('marks the notification as shown before awaiting dialog close', async () => {
    const dialogOpen = createDeferred()
    dialogService.showCloudNotification.mockImplementation(
      () => dialogOpen.promise
    )

    const wrapper = mount(DesktopCloudNotificationController)

    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)

    expect(settingStore.set).toHaveBeenCalledWith(
      'Comfy.Desktop.CloudNotificationShown',
      true
    )
    expect(settingStore.set.mock.invocationCallOrder[0]).toBeLessThan(
      dialogService.showCloudNotification.mock.invocationCallOrder[0]
    )

    dialogOpen.resolve()
    await flushPromises()

    wrapper.unmount()
  })
})
