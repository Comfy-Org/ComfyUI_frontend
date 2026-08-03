/**
 * Settings dialog migration regression net: `useSettingsDialog().show()` must
 * open the Reka-renderer path with sizing that matches the previous
 * `BaseModalLayout size="sm"` (960px × 80vh). Catches accidental reverts of
 * the Phase 3 renderer flip.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())
const teamWorkspacesFlag = vi.hoisted(() => ({ value: false }))
const isCloudRef = vi.hoisted(() => ({ value: false }))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog, closeDialog: vi.fn() })
}))

vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get teamWorkspacesEnabled() {
        return teamWorkspacesFlag.value
      }
    }
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return isCloudRef.value
  }
}))

vi.mock('@/i18n', () => ({ t: (k: string) => k }))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ trackEvent: vi.fn() })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: { value: true },
    isFreeTier: { value: false },
    type: { value: 'legacy' }
  })
}))

import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'

describe('useSettingsDialog', () => {
  beforeEach(() => {
    showDialog.mockReset()
    teamWorkspacesFlag.value = false
    isCloudRef.value = false
  })

  it("show() opens the Reka renderer with size 'full' and 1280px content sizing", () => {
    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('global-settings')
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.size).toBe('full')
    expect(args.dialogComponentProps.contentClass).toContain('max-w-[1280px]')
    expect(args.dialogComponentProps.contentClass).not.toContain(
      'max-w-[960px]'
    )
    expect(args.dialogComponentProps.contentClass).toContain('h-[80vh]')
  })

  it('show() uses non-modal Reka so nested PrimeVue dialogs keep focus and pointer events', () => {
    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.modal).toBe(false)
  })

  it('show() omits overlayClass when not in workspace mode', () => {
    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.overlayClass).toBeUndefined()
  })

  it("show() sets overlayClass 'p-8' when isCloud && teamWorkspacesEnabled", () => {
    isCloudRef.value = true
    teamWorkspacesFlag.value = true

    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.overlayClass).toBe('p-8')
  })

  it('show(panel) forwards defaultPanel to the dialog props', () => {
    useSettingsDialog().show('about')
    const [args] = showDialog.mock.calls[0]
    expect(args.props.defaultPanel).toBe('about')
  })

  it('showAbout() opens the about panel', () => {
    useSettingsDialog().showAbout()
    const [args] = showDialog.mock.calls[0]
    expect(args.props.defaultPanel).toBe('about')
  })
})
