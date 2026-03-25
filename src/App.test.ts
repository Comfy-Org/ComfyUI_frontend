import { flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import App from '@/App.vue'

const workspaceStore = reactive({
  spinner: false
})

const conflictDetection = {
  initializeConflictDetection: vi.fn()
}

let shownCloudNotification = false
const settingStore = {
  load: vi.fn<() => Promise<void>>(),
  get: vi.fn(() => shownCloudNotification),
  set: vi.fn(async (_key: string, value: boolean) => {
    shownCloudNotification = value
  })
}

const dialogService = {
  showCloudNotification: vi.fn<() => Promise<void>>()
}

let platform = 'darwin'
const showContextMenu = vi.fn()

vi.mock('@sentry/vue', () => ({
  captureException: vi.fn()
}))

vi.mock('@/config', () => ({
  default: {
    app_version: 'test-version'
  }
}))

vi.mock('@/components/dialog/GlobalDialog.vue', () => ({
  default: {
    template: '<div />'
  }
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isDesktop: true
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => settingStore
}))

vi.mock('primevue/blockui', () => ({
  default: {
    template: '<div><slot /></div>'
  }
}))

vi.mock('@/scripts/app', () => ({
  app: {}
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => dialogService
}))

vi.mock('@/stores/workspaceStore', () => ({
  useWorkspaceStore: () => workspaceStore
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({
    getPlatform: () => platform,
    showContextMenu
  })
}))

vi.mock('@/utils/preloadErrorUtil', () => ({
  parsePreloadError: vi.fn(() => ({
    url: '',
    fileType: 'script',
    chunkName: '',
    message: ''
  }))
}))

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: () => conflictDetection
  })
)

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

describe('App cloud notification', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    workspaceStore.spinner = false
    platform = 'darwin'
    shownCloudNotification = false

    settingStore.load.mockResolvedValue(undefined)
    settingStore.get.mockImplementation(() => shownCloudNotification)
    settingStore.set.mockImplementation(
      async (_key: string, value: boolean) => {
        shownCloudNotification = value
      }
    )
    dialogService.showCloudNotification.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function mountApp() {
    return shallowMount(App, {
      global: {
        stubs: {
          RouterView: true,
          GlobalDialog: true,
          BlockUI: true
        }
      }
    })
  }

  it('waits for settings to load before deciding whether to show the notification', async () => {
    const loadSettings = createDeferred()
    settingStore.load.mockImplementation(() => loadSettings.promise)

    const wrapper = mountApp()
    await nextTick()

    shownCloudNotification = true
    loadSettings.resolve()

    await flushPromises()
    await vi.advanceTimersByTimeAsync(2000)

    expect(dialogService.showCloudNotification).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('marks the notification as shown before awaiting dialog close', async () => {
    const dialogOpen = createDeferred()
    dialogService.showCloudNotification.mockImplementation(
      () => dialogOpen.promise
    )

    const wrapper = mountApp()

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
