import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCustomNodeEditorDialog } from './useCustomNodeEditorDialog'
import { useCustomNodePacksDialog } from './useCustomNodePacksDialog'

const mocks = vi.hoisted(() => ({
  showLayoutDialog: vi.fn(),
  closeDialog: vi.fn()
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ showLayoutDialog: mocks.showLayoutDialog })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: mocks.closeDialog })
}))

vi.mock('../components/CustomNodeEditorDialog.vue', () => ({
  default: { name: 'CustomNodeEditorDialog' }
}))

vi.mock('../components/CustomNodePacksDialog.vue', () => ({
  default: { name: 'CustomNodePacksDialog' }
}))

describe('custom node dialogs', () => {
  beforeEach(() => {
    mocks.showLayoutDialog.mockReset()
    mocks.closeDialog.mockReset()
  })

  it('uses the canonical maximized layout for the editor', () => {
    const session = {
      id: 'session-1',
      mode: 'create' as const,
      name: 'Checkerboard Mask',
      status: 'ready' as const,
      editorUrl: '/editor/session-1',
      editorKind: 'vscode' as const,
      agentEnabled: false,
      agentBusy: false,
      agentActivity: [],
      createdAt: '2026-08-28T12:00:00Z',
      updatedAt: '2026-08-28T12:00:01Z'
    }

    useCustomNodeEditorDialog().show(session, vi.fn())

    const options = mocks.showLayoutDialog.mock.calls[0][0]
    expect(options.dialogComponentProps).toMatchObject({
      renderer: 'reka',
      headless: true,
      modal: true,
      maximized: true
    })
    expect(options.dialogComponentProps.contentClass).toContain('inset-0')
    expect(options.dialogComponentProps.contentClass).toContain('min-h-0')
    expect(options.dialogComponentProps.contentClass).toContain(
      'overflow-hidden'
    )
  })

  it('keeps the pack manager within narrow and short viewports', () => {
    useCustomNodePacksDialog().show()

    const options = mocks.showLayoutDialog.mock.calls[0][0]
    expect(options.dialogComponentProps.contentClass).toContain('max-w-[90vw]')
    expect(options.dialogComponentProps.contentClass).toContain(
      'max-h-[calc(100dvh-1rem)]'
    )
    expect(options.dialogComponentProps.contentClass).toContain(
      'overflow-y-auto'
    )
  })
})
