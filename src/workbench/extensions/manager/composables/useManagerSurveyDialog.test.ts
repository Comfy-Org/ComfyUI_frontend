import { describe, expect, it, vi } from 'vitest'
import { useDialogStore } from '@/stores/dialogStore'

import { useManagerSurveyDialog } from '@/workbench/extensions/manager/composables/useManagerSurveyDialog'

describe('useManagerSurveyDialog', () => {
  it('show() opens the survey dialog under its own key via the Reka layout renderer', () => {
    useManagerSurveyDialog().show()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('global-manager-survey')
    expect(args.dialogComponentProps?.renderer).toBe('reka')
  })

  it('show() wires onClose to close the survey dialog', () => {
    useManagerSurveyDialog().show()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    const onClose =
      args.props && 'onClose' in args.props ? args.props.onClose : undefined
    expect(onClose).toBeTypeOf('function')
    if (typeof onClose !== 'function') throw new Error('Missing survey onClose')
    onClose()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'global-manager-survey'
    })
  })

  it('hide() closes the global-manager-survey dialog', () => {
    useManagerSurveyDialog().hide()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'global-manager-survey'
    })
  })
})
