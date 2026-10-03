import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { DialogContentSize } from '@/components/ui/dialog/dialog.variants'
import { dialogContentVariants } from '@/components/ui/dialog/dialog.variants'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useDialogStore } from '@/stores/dialogStore'
/**
 * Settings dialog regression net: `useSettingsDialog().show()` must open the
 * Reka-renderer path at the 1280px design width, capped to the workspace a
 * docked Agent panel leaves. Catches accidental reverts of the Phase 3
 * renderer flip and of the workspace-inset cap.
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

  const RESERVES_INSET = /var\(--workspace-inset-right,_?0px\)/

  const resolveAgainstVariant = (args: {
    dialogComponentProps: { size: DialogContentSize; contentClass: string }
  }): string =>
    cn(
      dialogContentVariants({
        size: args.dialogComponentProps.size,
        maximized: false
      }),
      args.dialogComponentProps.contentClass
    )

  const maxWidthCapsFromLastShow = (): string[] =>
    String(showDialog.mock.lastCall?.[0].dialogComponentProps.contentClass)
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
    expect(caps.filter((cap) => !RESERVES_INSET.test(cap))).toEqual([])
  })

  it("show() keeps both caps after cn() resolves them against the 'full' variant", () => {
    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]

    const resolved = resolveAgainstVariant(args)
    const survivingCaps = resolved
      .split(' ')
      .filter((utility) => /(^|:)max-w-\[/.test(utility))

    expect(survivingCaps.some((cap) => cap.startsWith('sm:'))).toBe(true)
    expect(survivingCaps.some((cap) => !cap.startsWith('sm:'))).toBe(true)
    expect(
      survivingCaps.filter(
        (cap) => !cap.includes('1280px') || !RESERVES_INSET.test(cap)
      )
    ).toEqual([])
  })

  it('show() keeps the workspace-aware centering that the cap is sized for', () => {
    useSettingsDialog().show()
    const [args] = showDialog.mock.calls[0]

    const horizontalPlacement = resolveAgainstVariant(args)
      .split(' ')
      .filter((utility) => /(^|:)left-/.test(utility))

    expect(horizontalPlacement).not.toHaveLength(0)
    expect(
      horizontalPlacement.filter((utility) => !RESERVES_INSET.test(utility))
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
