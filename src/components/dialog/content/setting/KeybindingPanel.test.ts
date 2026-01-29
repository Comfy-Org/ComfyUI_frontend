import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import KeybindingPanel from './KeybindingPanel.vue'
import {
  KeyComboImpl,
  KeybindingImpl,
  useKeybindingStore
} from '@/stores/keybindingStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

const mockPersist = vi.fn().mockResolvedValue(undefined)
vi.mock('@/services/keybindingService', () => ({
  useKeybindingService: () => ({
    persistUserKeybindings: mockPersist
  })
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: vi.fn()
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    commands: {
      'test-command': { id: 'test-command', label: 'Test Command' },
      'command-a': { id: 'command-a', label: 'Command A' },
      'command-b': { id: 'command-b', label: 'Command B' }
    }
  })
}))

describe('KeybindingPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const mountPanel = () => {
    return mount(KeybindingPanel, {
      global: {
        plugins: [PrimeVue, i18n],
        directives: { tooltip: Tooltip },
        stubs: {
          DataTable: true,
          Column: true,
          Dialog: {
            template:
              '<div v-if="visible"><slot /><slot name="footer" /></div>',
            props: ['visible', 'header']
          },
          InputText: true,
          Message: true,
          Tag: true,
          Button: true,
          SearchBox: true,
          PanelTemplate: {
            template: '<div><slot /><slot name="header" /></div>'
          },
          KeyComboDisplay: true
        }
      }
    })
  }

  describe('saveKeybinding', () => {
    it('should close dialog before updating store to prevent warning flash', async () => {
      const keybindingStore = useKeybindingStore()
      let dialogVisibleWhenStoreUpdated: boolean | undefined

      const wrapper = mountPanel()
      const vm = wrapper.vm as InstanceType<typeof KeybindingPanel>

      // Patch keybindingStore to capture dialog state when store is updated
      const originalUpdate = keybindingStore.updateKeybindingOnCommand
      keybindingStore.updateKeybindingOnCommand = (keybinding) => {
        dialogVisibleWhenStoreUpdated = (
          vm as unknown as { editDialogVisible: boolean }
        ).editDialogVisible
        return originalUpdate.call(keybindingStore, keybinding)
      }

      // Setup editing state
      ;(
        vm as unknown as { currentEditingCommand: { id: string } }
      ).currentEditingCommand = { id: 'test-command' }
      ;(
        vm as unknown as { newBindingKeyCombo: KeyComboImpl }
      ).newBindingKeyCombo = new KeyComboImpl({ key: 's', ctrl: true })
      ;(vm as unknown as { editDialogVisible: boolean }).editDialogVisible =
        true

      await (
        vm as unknown as { saveKeybinding: () => Promise<void> }
      ).saveKeybinding()

      // Dialog should be closed when store updates (prevents warning flash)
      expect(dialogVisibleWhenStoreUpdated).toBe(false)
    })

    it('should persist keybinding after closing dialog', async () => {
      const wrapper = mountPanel()
      const vm = wrapper.vm as InstanceType<typeof KeybindingPanel>

      // Setup editing state
      ;(
        vm as unknown as { currentEditingCommand: { id: string } }
      ).currentEditingCommand = { id: 'test-command' }
      ;(
        vm as unknown as { newBindingKeyCombo: KeyComboImpl }
      ).newBindingKeyCombo = new KeyComboImpl({ key: 's', ctrl: true })
      ;(vm as unknown as { editDialogVisible: boolean }).editDialogVisible =
        true

      await (
        vm as unknown as { saveKeybinding: () => Promise<void> }
      ).saveKeybinding()

      expect(mockPersist).toHaveBeenCalled()
      expect(
        (vm as unknown as { editDialogVisible: boolean }).editDialogVisible
      ).toBe(false)
    })

    it('should not show warning after save button is clicked', async () => {
      const keybindingStore = useKeybindingStore()

      // Setup existing keybinding that will conflict
      keybindingStore.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'existing-command',
          combo: new KeyComboImpl({ key: 's', ctrl: true })
        })
      )

      const wrapper = mountPanel()
      const vm = wrapper.vm as InstanceType<typeof KeybindingPanel>

      // Setup editing with conflicting combo
      ;(
        vm as unknown as {
          currentEditingCommand: { id: string; keybinding: null }
        }
      ).currentEditingCommand = {
        id: 'new-command',
        keybinding: null
      }
      ;(
        vm as unknown as { newBindingKeyCombo: KeyComboImpl }
      ).newBindingKeyCombo = new KeyComboImpl({ key: 's', ctrl: true })
      ;(vm as unknown as { editDialogVisible: boolean }).editDialogVisible =
        true
      await nextTick()

      // Verify warning is shown before save
      expect(
        (vm as unknown as { existingKeybindingOnCombo: KeybindingImpl | null })
          .existingKeybindingOnCombo
      ).not.toBeNull()

      // Click save
      await (
        vm as unknown as { saveKeybinding: () => Promise<void> }
      ).saveKeybinding()
      await nextTick()

      // After save, dialog should be closed AND state should be cleared
      expect(
        (vm as unknown as { editDialogVisible: boolean }).editDialogVisible
      ).toBe(false)
      expect(
        (vm as unknown as { currentEditingCommand: null }).currentEditingCommand
      ).toBeNull()
      expect(
        (vm as unknown as { newBindingKeyCombo: null }).newBindingKeyCombo
      ).toBeNull()
    })
  })

  describe('keybinding overwrite flow', () => {
    it('should successfully overwrite existing keybinding without flash', async () => {
      const keybindingStore = useKeybindingStore()

      // Setup existing keybinding
      keybindingStore.addUserKeybinding(
        new KeybindingImpl({
          commandId: 'command-a',
          combo: new KeyComboImpl({ key: 'a', ctrl: true })
        })
      )

      const wrapper = mountPanel()
      const vm = wrapper.vm as InstanceType<typeof KeybindingPanel>

      // Open edit for command-b with same combo (conflict)
      ;(
        vm as unknown as {
          currentEditingCommand: { id: string; keybinding: null }
        }
      ).currentEditingCommand = {
        id: 'command-b',
        keybinding: null
      }
      ;(
        vm as unknown as { newBindingKeyCombo: KeyComboImpl }
      ).newBindingKeyCombo = new KeyComboImpl({ key: 'a', ctrl: true })
      ;(vm as unknown as { editDialogVisible: boolean }).editDialogVisible =
        true
      await nextTick()

      // Verify conflict detected
      expect(
        (vm as unknown as { existingKeybindingOnCombo: KeybindingImpl })
          .existingKeybindingOnCombo?.commandId
      ).toBe('command-a')

      // Save (overwrite)
      await (
        vm as unknown as { saveKeybinding: () => Promise<void> }
      ).saveKeybinding()

      // Verify dialog closed
      expect(
        (vm as unknown as { editDialogVisible: boolean }).editDialogVisible
      ).toBe(false)

      // Verify new keybinding saved
      expect(
        keybindingStore.getKeybindingByCommandId('command-b')
      ).toBeDefined()

      // Verify combo now belongs to command-b
      const combo = new KeyComboImpl({ key: 'a', ctrl: true })
      expect(keybindingStore.getKeybinding(combo)?.commandId).toBe('command-b')

      // Verify persistence called
      expect(mockPersist).toHaveBeenCalled()
    })
  })
})
