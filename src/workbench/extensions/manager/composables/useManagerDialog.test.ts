/**
 * Manager dialog migration regression net: `useManagerDialog().show()` must
 * route through the Reka renderer at the legacy Manager dimensions (1724px
 * max-width × 80vh, expanding at 3000px). Catches accidental reverts of the
 * Phase 4 renderer flip.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())
const closeDialog = vi.hoisted(() => vi.fn())

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog, closeDialog })
}))

import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import { useManagerDialog } from '@/workbench/extensions/manager/composables/useManagerDialog'

describe('useManagerDialog', () => {
  beforeEach(() => {
    showDialog.mockReset()
    closeDialog.mockReset()
  })

  it("show() opens the Reka renderer with size 'full' and Manager content sizing", () => {
    useManagerDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('global-manager')
    expect(args.dialogComponentProps.size).toBe('full')
    expect(args.dialogComponentProps.contentClass).toContain('max-w-[1724px]')
    expect(args.dialogComponentProps.contentClass).toContain('h-[80vh]')
    expect(args.dialogComponentProps.contentClass).toContain('max-h-[1026px]')
    expect(args.dialogComponentProps.contentClass).toContain(
      'min-[3000px]:max-w-[2200px]'
    )
  })

  it('show() uses non-modal Reka so nested PrimeVue overlays keep focus and pointer events', () => {
    useManagerDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.modal).toBe(false)
  })

  it('show(initialTab) forwards initialTab to ManagerDialog props', () => {
    useManagerDialog().show(ManagerTab.UpdateAvailable)
    const [args] = showDialog.mock.calls[0]
    expect(args.props.initialTab).toBe(ManagerTab.UpdateAvailable)
  })

  it('show(initialTab, initialPackId) forwards initialPackId to ManagerDialog props', () => {
    useManagerDialog().show(ManagerTab.All, 'pack-123')
    const [args] = showDialog.mock.calls[0]
    expect(args.props.initialPackId).toBe('pack-123')
  })

  it('hide() closes the global-manager dialog', () => {
    useManagerDialog().hide()
    expect(closeDialog).toHaveBeenCalledWith({ key: 'global-manager' })
  })
})
