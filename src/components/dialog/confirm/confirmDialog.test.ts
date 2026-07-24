/**
 * Dialog migration regression net: the showConfirmDialog helper must open
 * its dialog through the Reka renderer with zeroed section padding (the
 * Confirm* sections carry their own). Catches accidental reverts of the
 * Phase 6 renderer flip.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog })
}))

import ConfirmBody from '@/components/dialog/confirm/ConfirmBody.vue'
import ConfirmFooter from '@/components/dialog/confirm/ConfirmFooter.vue'
import ConfirmHeader from '@/components/dialog/confirm/ConfirmHeader.vue'
import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'

describe('showConfirmDialog Reka renderer opt-in', () => {
  beforeEach(() => {
    showDialog.mockReset()
  })

  it("sets renderer 'reka' with size 'md' and zeroed section padding", () => {
    showConfirmDialog()

    const [args] = showDialog.mock.calls[0]
    expect(args.dialogComponentProps.renderer).toBe('reka')
    expect(args.dialogComponentProps.size).toBe('md')
    expect(args.dialogComponentProps.headerClass).toBe('p-0')
    expect(args.dialogComponentProps.bodyClass).toBe('p-0')
    expect(args.dialogComponentProps.footerClass).toBe('p-0')
    expect(args.dialogComponentProps.pt).toBeUndefined()
  })

  it('forwards the confirm section components and caller props', () => {
    showConfirmDialog({
      key: 'confirm-test',
      headerProps: { title: 'Title' },
      props: { promptText: 'Prompt' },
      footerProps: { confirmText: 'Delete' }
    })

    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('confirm-test')
    expect(args.headerComponent).toBe(ConfirmHeader)
    expect(args.component).toBe(ConfirmBody)
    expect(args.footerComponent).toBe(ConfirmFooter)
    expect(args.headerProps).toEqual({ title: 'Title' })
    expect(args.props).toEqual({ promptText: 'Prompt' })
    expect(args.footerProps).toEqual({ confirmText: 'Delete' })
  })
})
