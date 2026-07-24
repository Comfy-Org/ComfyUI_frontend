import { beforeEach, describe, expect, it, vi } from 'vitest'

const showDialog = vi.hoisted(() => vi.fn())
const closeDialog = vi.hoisted(() => vi.fn())

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ showDialog, closeDialog })
}))

import { useManagerSurveyDialog } from '@/workbench/extensions/manager/composables/useManagerSurveyDialog'

describe('useManagerSurveyDialog', () => {
  beforeEach(() => {
    showDialog.mockReset()
    closeDialog.mockReset()
  })

  it('show() opens the survey dialog under its own key via the Reka layout renderer', () => {
    useManagerSurveyDialog().show()
    const [args] = showDialog.mock.calls[0]
    expect(args.key).toBe('global-manager-survey')
    expect(args.dialogComponentProps.renderer).toBe('reka')
  })

  it('show() wires onClose to close the survey dialog', () => {
    useManagerSurveyDialog().show()
    const [args] = showDialog.mock.calls[0]
    args.props.onClose()
    expect(closeDialog).toHaveBeenCalledWith({ key: 'global-manager-survey' })
  })

  it('hide() closes the global-manager-survey dialog', () => {
    useManagerSurveyDialog().hide()
    expect(closeDialog).toHaveBeenCalledWith({ key: 'global-manager-survey' })
  })
})
