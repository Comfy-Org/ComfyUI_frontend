import { describe, expect, it, vi } from 'vitest'

import { DIALOG_KEY, useEditKeybindingDialog } from './useEditKeybindingDialog'

const mockShowSmallLayoutDialog = vi.fn()
const mockGetKeybinding = vi.fn()

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showSmallLayoutDialog: mockShowSmallLayoutDialog
  })
}))

vi.mock('@/platform/keybindings/keybindingStore', () => ({
  useKeybindingStore: () => ({
    getKeybinding: mockGetKeybinding
  })
}))

vi.mock(
  '@/components/dialog/content/setting/keybinding/EditKeybindingContent.vue',
  () => ({
    default: { name: 'EditKeybindingContent' }
  })
)

vi.mock(
  '@/components/dialog/content/setting/keybinding/EditKeybindingFooter.vue',
  () => ({
    default: { name: 'EditKeybindingFooter' }
  })
)

vi.mock(
  '@/components/dialog/content/setting/keybinding/EditKeybindingHeader.vue',
  () => ({
    default: { name: 'EditKeybindingHeader' }
  })
)

function makeCombo(label: string) {
  return {
    label,
    equals: vi.fn((other: { label: string }) => other.label === label)
  }
}

describe('useEditKeybindingDialog', () => {
  it('opens the edit dialog with default edit state', () => {
    const currentCombo = makeCombo('Ctrl+A')

    useEditKeybindingDialog().show({
      commandId: 'app.test',
      commandLabel: 'Test command',
      currentCombo
    })

    expect(mockShowSmallLayoutDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        key: DIALOG_KEY,
        props: expect.objectContaining({
          commandLabel: 'Test command'
        })
      })
    )
    const dialog = mockShowSmallLayoutDialog.mock.calls[0][0]
    expect(dialog.props.dialogState).toMatchObject({
      commandId: 'app.test',
      newCombo: currentCombo,
      currentCombo,
      mode: 'edit',
      existingBinding: null
    })
    expect(dialog.footerProps.dialogState).toBe(dialog.props.dialogState)
  })

  it('updates combo state and reports a conflicting binding', () => {
    const currentCombo = makeCombo('Ctrl+A')
    const newCombo = makeCombo('Ctrl+B')
    const binding = { commandId: 'other.command' }
    mockGetKeybinding.mockReturnValue(binding)

    useEditKeybindingDialog().show({
      commandId: 'app.test',
      commandLabel: 'Test command',
      currentCombo,
      mode: 'add',
      existingBinding: binding
    })

    const dialog = mockShowSmallLayoutDialog.mock.calls.at(-1)![0]
    dialog.props.onUpdateCombo(newCombo)

    expect(dialog.props.dialogState.newCombo).toMatchObject({
      label: 'Ctrl+B'
    })
    expect(dialog.props.existingKeybindingOnCombo.value).toBe(binding)
    expect(mockGetKeybinding.mock.calls.at(-1)?.[0]).toMatchObject({
      label: 'Ctrl+B'
    })
  })

  it('does not report a conflict for an unchanged or empty combo', () => {
    const currentCombo = makeCombo('Ctrl+A')

    useEditKeybindingDialog().show({
      commandId: 'app.test',
      commandLabel: 'Test command',
      currentCombo
    })

    const dialog = mockShowSmallLayoutDialog.mock.calls.at(-1)![0]

    expect(dialog.props.existingKeybindingOnCombo.value).toBeNull()
    dialog.props.dialogState.newCombo = null
    expect(dialog.props.existingKeybindingOnCombo.value).toBeNull()
  })
})
