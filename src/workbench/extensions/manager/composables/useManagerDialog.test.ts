import { describe, expect, it, vi } from 'vitest'
import { useDialogStore } from '@/stores/dialogStore'

import { ManagerTab } from '@/workbench/extensions/manager/types/comfyManagerTypes'
import { useManagerDialog } from '@/workbench/extensions/manager/composables/useManagerDialog'

describe('useManagerDialog', () => {
  it('show() opens the global-manager dialog', () => {
    useManagerDialog().show()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('global-manager')
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
