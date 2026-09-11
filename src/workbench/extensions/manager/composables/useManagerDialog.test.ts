/**
 * Manager dialog migration regression net: `useManagerDialog().show()` must
 * route through the Reka renderer at the legacy Manager dimensions (1724px
 * max-width × 80vh, expanding at 3000px). Catches accidental reverts of the
 * Phase 4 renderer flip.
 */
import { describe, expect, it, vi } from 'vitest'
import { useDialogStore } from '@/stores/dialogStore'

import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import { useManagerDialog } from '@/workbench/extensions/manager/composables/useManagerDialog'

describe('useManagerDialog', () => {
  it("show() opens the Reka renderer with size 'full' and Manager content sizing", () => {
    useManagerDialog().show()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('global-manager')
    expect(args.dialogComponentProps!.renderer).toBe('reka')
    expect(args.dialogComponentProps!.size).toBe('full')
    expect(args.dialogComponentProps!.contentClass).toContain('max-w-[1724px]')
    expect(args.dialogComponentProps!.contentClass).toContain('h-[80vh]')
    expect(args.dialogComponentProps!.contentClass).toContain('max-h-[1026px]')
    expect(args.dialogComponentProps!.contentClass).toContain(
      'min-[3000px]:max-w-[2200px]'
    )
  })

  it('show() uses non-modal Reka so nested PrimeVue overlays keep focus and pointer events', () => {
    useManagerDialog().show()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps!.modal).toBe(false)
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
})
