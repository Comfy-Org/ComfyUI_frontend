import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent } from 'vue'

const mockSettingGet = vi.hoisted(() => vi.fn())
const mockTrackUiButtonClicked = vi.hoisted(() => vi.fn())
const mockReleaseStore = vi.hoisted(() => ({
  shouldShowRedDot: { value: false },
  initialize: vi.fn()
}))
const mockHelpCenterStore = vi.hoisted(() => ({
  isVisible: { value: false },
  toggle: vi.fn(),
  hide: vi.fn()
}))
const mockConflictDetection = vi.hoisted(() => ({
  shouldShowConflictModalAfterUpdate: vi.fn()
}))
const mockShowNodeConflictDialog = vi.hoisted(() => vi.fn())
const mockConflictAcknowledgment = vi.hoisted(() => ({
  shouldShowRedDot: { value: false },
  markConflictsAsSeen: vi.fn()
}))

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => store
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: mockSettingGet })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackUiButtonClicked: mockTrackUiButtonClicked
  })
}))

vi.mock('@/platform/updates/common/releaseStore', () => ({
  useReleaseStore: () => mockReleaseStore
}))

vi.mock('@/stores/helpCenterStore', () => ({
  useHelpCenterStore: () => mockHelpCenterStore
}))

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: () => mockConflictDetection
  })
)

vi.mock(
  '@/workbench/extensions/manager/composables/useNodeConflictDialog',
  () => ({
    useNodeConflictDialog: () => ({ show: mockShowNodeConflictDialog })
  })
)

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictAcknowledgment',
  () => ({
    useConflictAcknowledgment: () => mockConflictAcknowledgment
  })
)

import { useHelpCenter } from './useHelpCenter'

function mountHelpCenter() {
  let result: ReturnType<typeof useHelpCenter> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        result = useHelpCenter()
        return () => null
      }
    })
  )
  app.mount(document.createElement('div'))
  if (!result) throw new Error('Expected help center composable to initialize')
  return { app, result }
}

describe('useHelpCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingGet.mockReturnValue('left')
    mockReleaseStore.shouldShowRedDot.value = false
    mockHelpCenterStore.isVisible.value = false
    mockHelpCenterStore.toggle.mockImplementation(() => {
      mockHelpCenterStore.isVisible.value = !mockHelpCenterStore.isVisible.value
    })
    mockHelpCenterStore.hide.mockImplementation(() => {
      mockHelpCenterStore.isVisible.value = false
    })
    mockConflictAcknowledgment.shouldShowRedDot.value = false
    mockConflictDetection.shouldShowConflictModalAfterUpdate.mockResolvedValue(
      false
    )
  })

  it('initializes releases on mount and exposes store-backed computed state', async () => {
    mockReleaseStore.shouldShowRedDot.value = true
    const { app, result } = mountHelpCenter()

    expect(mockReleaseStore.initialize).toHaveBeenCalledOnce()
    expect(result.isHelpCenterVisible.value).toBe(false)
    expect(result.shouldShowRedDot.value).toBe(true)
    expect(result.sidebarLocation.value).toBe('left')

    app.unmount()
  })

  it('uses the conflict red dot when the release red dot is hidden', () => {
    mockConflictAcknowledgment.shouldShowRedDot.value = true
    const { app, result } = mountHelpCenter()

    expect(result.shouldShowRedDot.value).toBe(true)

    app.unmount()
  })

  it('tracks and toggles help center visibility', () => {
    const { app, result } = mountHelpCenter()

    result.toggleHelpCenter()

    expect(mockTrackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'sidebar_help_center_toggled',
      element_group: 'sidebar'
    })
    expect(mockHelpCenterStore.toggle).toHaveBeenCalledOnce()
    expect(mockHelpCenterStore.isVisible.value).toBe(true)

    result.closeHelpCenter()

    expect(mockHelpCenterStore.hide).toHaveBeenCalledOnce()
    expect(mockHelpCenterStore.isVisible.value).toBe(false)
    app.unmount()
  })

  it('opens the conflict modal after the whats-new dialog when needed', async () => {
    mockConflictDetection.shouldShowConflictModalAfterUpdate.mockResolvedValue(
      true
    )
    const { app, result } = mountHelpCenter()

    await result.handleWhatsNewDismissed()

    expect(mockShowNodeConflictDialog).toHaveBeenCalledWith({
      showAfterWhatsNew: true,
      dialogComponentProps: {
        onClose: expect.any(Function)
      }
    })
    const options = mockShowNodeConflictDialog.mock.calls[0][0]
    options.dialogComponentProps.onClose()
    expect(
      mockConflictAcknowledgment.markConflictsAsSeen
    ).toHaveBeenCalledOnce()
    app.unmount()
  })

  it('does not open the conflict modal when not needed', async () => {
    const { app, result } = mountHelpCenter()

    await result.handleWhatsNewDismissed()

    expect(mockShowNodeConflictDialog).not.toHaveBeenCalled()
    app.unmount()
  })

  it('logs conflict-check failures without throwing', async () => {
    const error = new Error('failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockConflictDetection.shouldShowConflictModalAfterUpdate.mockRejectedValue(
      error
    )
    const { app, result } = mountHelpCenter()

    await expect(result.handleWhatsNewDismissed()).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith(
      '[HelpCenter] Error checking conflict modal:',
      error
    )
    app.unmount()
    consoleError.mockRestore()
  })
})
