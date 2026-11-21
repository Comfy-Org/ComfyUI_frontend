import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import { KeyComboImpl } from '@comfyorg/keybindings/keyCombo'
import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogStore } from '@/stores/dialogStore'
import { testI18n } from '@/utils/__tests__/testI18n'

import EditKeybindingFooter from './EditKeybindingFooter.vue'
import { EDIT_KEYBINDING_DIALOG_KEY } from './editKeybindingDialogState'
import type { EditKeybindingDialogState } from './editKeybindingDialogState'

const ctrlK = { key: 'k', ctrl: true }

function renderFooter(existingKeybindingOnCombo: KeybindingImpl | null) {
  const dialogState = reactive<EditKeybindingDialogState>({
    commandId: 'test.incoming',
    newCombo: new KeyComboImpl(ctrlK),
    currentCombo: null,
    mode: 'add',
    existingBinding: null
  })
  return render(EditKeybindingFooter, {
    props: { dialogState, existingKeybindingOnCombo },
    global: { plugins: [testI18n] }
  })
}

describe('EditKeybindingFooter', () => {
  it('replaces the holder and persists when Overwrite is confirmed', async () => {
    const settingStore = useSettingStore()
    vi.mocked(settingStore.setMany).mockResolvedValue(undefined)
    const store = useKeybindingStore()
    const holder = new KeybindingImpl({
      commandId: 'test.holder',
      combo: ctrlK
    })
    store.addDefaultKeybinding(holder)
    renderFooter(holder)

    await userEvent.click(screen.getByRole('button', { name: 'Overwrite' }))

    expect(store.getKeybinding(holder.combo)?.commandId).toBe('test.incoming')
    expect(store.getKeybindingsByCommandId('test.holder')).toEqual([])
    expect(settingStore.setMany).toHaveBeenCalledOnce()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: EDIT_KEYBINDING_DIALOG_KEY
    })
  })

  it('stays open and persists nothing when the combo became occupied after the dialog offered Save', async () => {
    const settingStore = useSettingStore()
    const store = useKeybindingStore()
    const holder = new KeybindingImpl({
      commandId: 'test.holder',
      combo: ctrlK
    })
    store.addDefaultKeybinding(holder)
    renderFooter(null)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(store.getKeybinding(holder.combo)).toEqual(holder)
    expect(settingStore.setMany).not.toHaveBeenCalled()
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
  })
})
