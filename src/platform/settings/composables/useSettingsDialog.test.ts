import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import { dialogContentVariants } from '@/components/ui/dialog/dialog.variants'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useDialogStore } from '@/stores/dialogStore'
/**
 * Settings dialog migration regression net: `useSettingsDialog().show()` must
 * open the Reka-renderer path with sizing that matches the previous
 * `BaseModalLayout size="sm"` (960px × 80vh). Catches accidental reverts of
 * the Phase 3 renderer flip.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())
const isCloudRef = vi.hoisted(() => ({ value: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return isCloudRef.value
  }
}))

vi.mock(import('@/i18n'))

vi.mock(import('@/platform/telemetry'))

beforeEach(() => {
  const billing = useBillingContext()
  Object.assign(billing, {
    canAccessSubscriptionFeatures: computed(() => true),
    isFreeTier: computed(() => false),
    type: computed(() => 'legacy')
  })
  vi.mocked(useBillingContext).mockReturnValue(billing)
})

vi.mock(import('@/composables/billing/useBillingContext'))

import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'

beforeEach(() => {
  useDialogStore().showDialog = showDialog
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => undefined)
})

describe('useSettingsDialog', () => {
  beforeEach(() => {
    isCloudRef.value = false
  })

  const maxWidthCapsFromLastShow = (): string[] =>
    String(showDialog.mock.calls[0][0].dialogComponentProps.contentClass)
      .split(' ')
      .filter((utility) => /(^|:)max-w-\[/.test(utility))

  it("show() opens the Reka renderer with size 'full' and 1280px content sizing", () => {
    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('global-settings')
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.size).toBe('full')
    expect(args.dialogComponentProps.contentClass).toContain('h-[80vh]')

    const caps = maxWidthCapsFromLastShow()
    expect(caps).not.toHaveLength(0)
    expect(caps.filter((cap) => !cap.includes('1280px'))).toEqual([])
    expect(caps.filter((cap) => cap.includes('960px'))).toEqual([])
  })

  it('show() reserves the docked Agent panel width in every max-width cap', () => {
    useSettingsDialog().show()

    const caps = maxWidthCapsFromLastShow()
    expect(caps).not.toHaveLength(0)
    expect(
      caps.filter((cap) => !cap.includes('var(--workspace-inset-right,0px)'))
    ).toEqual([])
  })

  it("show() keeps both caps after cn() resolves them against the 'full' variant", () => {
    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]

    const resolved = cn(
      dialogContentVariants({ size: 'full', maximized: false }),
      args.dialogComponentProps.contentClass
    )
    const survivingCaps = resolved
      .split(' ')
      .filter((utility) => /(^|:)max-w-\[/.test(utility))

    expect(survivingCaps.some((cap) => cap.startsWith('sm:'))).toBe(true)
    expect(
      survivingCaps.filter(
        (cap) =>
          !cap.includes('1280px') ||
          !cap.includes('var(--workspace-inset-right,0px)')
      )
    ).toEqual([])
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

  it("show() sets overlayClass 'p-8' on Cloud", () => {
    isCloudRef.value = true

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
