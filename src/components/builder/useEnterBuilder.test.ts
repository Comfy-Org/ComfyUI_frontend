import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAppMode } from '@/composables/useAppMode'
import { useAppModeStore } from '@/stores/appModeStore'

import { useEmptyWorkflowDialog } from './useEmptyWorkflowDialog'
import { useEnterBuilder } from './useEnterBuilder'

vi.mock(import('@/composables/useAppMode'))

vi.mock<unknown>(import('./useEmptyWorkflowDialog'), () => {
  const dialog = { show: vi.fn() }
  return { useEmptyWorkflowDialog: () => dialog }
})

function setHasNodes(hasNodes: boolean) {
  Object.assign(useAppModeStore(), { hasNodes })
}

function lastDialogOptions() {
  const calls = vi.mocked(useEmptyWorkflowDialog().show).mock.calls
  return calls[calls.length - 1][0]
}

describe('useEnterBuilder', () => {
  beforeEach(() => {
    setHasNodes(false)
    vi.mocked(useAppModeStore().enterBuilder).mockImplementation(() => {})
  })

  it('enters the builder directly when the graph has nodes', () => {
    setHasNodes(true)

    useEnterBuilder().enterBuilder()

    expect(useAppModeStore().enterBuilder).toHaveBeenCalledOnce()
    expect(useEmptyWorkflowDialog().show).not.toHaveBeenCalled()
  })

  it('shows the empty workflow dialog instead when the graph has no nodes', () => {
    useEnterBuilder().enterBuilder()

    expect(useAppModeStore().enterBuilder).not.toHaveBeenCalled()
    expect(useEmptyWorkflowDialog().show).toHaveBeenCalledOnce()
  })

  it('returns to graph mode when the dialog is dismissed', () => {
    useEnterBuilder().enterBuilder()

    lastDialogOptions().onDismiss()

    expect(useAppMode().setMode).toHaveBeenCalledWith('graph')
  })

  it('re-checks for nodes when the dialog asks to enter the builder', () => {
    useEnterBuilder().enterBuilder()
    const { onEnterBuilder } = lastDialogOptions()

    onEnterBuilder()
    expect(useAppModeStore().enterBuilder).not.toHaveBeenCalled()
    expect(useEmptyWorkflowDialog().show).toHaveBeenCalledTimes(2)

    setHasNodes(true)
    onEnterBuilder()
    expect(useAppModeStore().enterBuilder).toHaveBeenCalledOnce()
  })
})
