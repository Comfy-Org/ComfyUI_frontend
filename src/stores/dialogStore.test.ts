import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { useDialogStore } from '@/stores/dialogStore'

const MockComponent = defineComponent({
  name: 'MockComponent',
  template: '<div>Mock</div>'
})

const MockContentPropsComponent = defineComponent({
  name: 'MockContentPropsComponent',
  props: {
    openingAction: {
      type: String,
      default: null
    }
  },
  template: '<div>Mock</div>'
})

describe('dialogStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('priority system', () => {
    it('should create dialogs in correct priority order', () => {
      const store = useDialogStore()

      // Create dialogs with different priorities
      store.showDialog({
        key: 'low-priority',
        component: MockComponent,
        priority: 0
      })

      store.showDialog({
        key: 'high-priority',
        component: MockComponent,
        priority: 10
      })

      store.showDialog({
        key: 'medium-priority',
        component: MockComponent,
        priority: 5
      })

      store.showDialog({
        key: 'no-priority',
        component: MockComponent
      })

      // Check order: high (2) -> medium (1) -> low (0)
      expect(store.dialogStack.map((d) => d.key)).toEqual([
        'high-priority',
        'medium-priority',
        'no-priority',
        'low-priority'
      ])
    })

    it('should maintain priority order when rising dialogs', () => {
      const store = useDialogStore()

      // Create dialogs with different priorities
      store.showDialog({
        key: 'priority-2',
        component: MockComponent,
        priority: 2
      })

      store.showDialog({
        key: 'priority-1',
        component: MockComponent,
        priority: 1
      })

      store.showDialog({
        key: 'priority-0',
        component: MockComponent,
        priority: 0
      })

      // Try to rise the lowest priority dialog
      store.riseDialog({ key: 'priority-0' })

      // Should still be at the bottom because of its priority
      expect(store.dialogStack.map((d) => d.key)).toEqual([
        'priority-2',
        'priority-1',
        'priority-0'
      ])

      // Rise the medium priority dialog
      store.riseDialog({ key: 'priority-1' })

      // Should be above priority-0 but below priority-2
      expect(store.dialogStack.map((d) => d.key)).toEqual([
        'priority-2',
        'priority-1',
        'priority-0'
      ])
    })

    it('should keep high priority dialogs on top when creating new lower priority dialogs', () => {
      const store = useDialogStore()

      // Create a high priority dialog (like manager progress)
      store.showDialog({
        key: 'manager-progress',
        component: MockComponent,
        priority: 10
      })

      store.showDialog({
        key: 'dialog-2',
        component: MockComponent,
        priority: 0
      })

      store.showDialog({
        key: 'dialog-3',
        component: MockComponent
        // Default priority is 1
      })

      // Manager progress should still be on top
      expect(store.dialogStack[0].key).toBe('manager-progress')

      // Check full order
      expect(store.dialogStack.map((d) => d.key)).toEqual([
        'manager-progress', // priority 2
        'dialog-3', // priority 1 (default)
        'dialog-2' // priority 0
      ])
    })
  })

  describe('basic dialog operations', () => {
    it('generates a key when none is provided', () => {
      const store = useDialogStore()

      const dialog = store.showDialog({ component: MockComponent })

      expect(dialog.key).toMatch(/^dialog-/)
      expect(store.isDialogOpen(dialog.key)).toBe(true)
    })

    it('evicts the first stack entry when the stack is full', () => {
      const store = useDialogStore()

      for (let i = 0; i < 11; i++) {
        store.showDialog({
          key: `dialog-${i}`,
          component: MockComponent,
          priority: i
        })
      }

      expect(store.dialogStack).toHaveLength(10)
      expect(store.isDialogOpen('dialog-9')).toBe(false)
    })

    it('stores optional header and footer components and props', () => {
      const store = useDialogStore()

      const dialog = store.showDialog({
        key: 'with-slots',
        component: MockComponent,
        headerComponent: MockComponent,
        footerComponent: MockComponent,
        headerProps: { title: 'Header' },
        footerProps: { action: 'Save' }
      })

      expect(dialog.headerComponent).toBeDefined()
      expect(dialog.footerComponent).toBeDefined()
      expect(dialog.headerProps).toEqual({ title: 'Header' })
      expect(dialog.footerProps).toEqual({ action: 'Save' })
    })

    it('runs dialog lifecycle handlers', () => {
      const store = useDialogStore()
      const onClose = vi.fn()
      const dialog = store.showDialog({
        key: 'lifecycle',
        component: MockComponent,
        dialogComponentProps: { onClose }
      })
      const props =
        dialog.dialogComponentProps as typeof dialog.dialogComponentProps & {
          onAfterHide: () => void
          onMaximize: () => void
          onUnmaximize: () => void
          pt: { root: { onMousedown: () => void } }
        }

      props.onMaximize()
      expect(dialog.dialogComponentProps.maximized).toBe(true)

      props.onUnmaximize()
      expect(dialog.dialogComponentProps.maximized).toBe(false)

      props.pt.root.onMousedown()
      expect(store.activeKey).toBe('lifecycle')

      props.onAfterHide()
      expect(onClose).toHaveBeenCalledOnce()
      expect(store.isDialogOpen('lifecycle')).toBe(false)
    })

    it('does nothing when rising or closing a missing dialog', () => {
      const store = useDialogStore()

      store.riseDialog({ key: 'missing' })
      store.closeDialog({ key: 'missing' })

      expect(store.dialogStack).toEqual([])
      expect(store.activeKey).toBeNull()
    })

    it('closes the active dialog when no key is provided', () => {
      const store = useDialogStore()

      store.showDialog({ key: 'active', component: MockComponent })
      store.closeDialog()

      expect(store.isDialogOpen('active')).toBe(false)
      expect(store.activeKey).toBeNull()
    })

    it('disables escape closing for a non-closable active dialog', () => {
      const store = useDialogStore()

      const dialog = store.showDialog({
        key: 'locked',
        component: MockComponent,
        dialogComponentProps: { closable: false }
      })

      expect(dialog.dialogComponentProps.closeOnEscape).toBe(false)
    })

    it('should show and close dialogs', () => {
      const store = useDialogStore()

      store.showDialog({
        key: 'test-dialog',
        component: MockComponent
      })

      expect(store.dialogStack).toHaveLength(1)
      expect(store.isDialogOpen('test-dialog')).toBe(true)

      store.closeDialog({ key: 'test-dialog' })

      expect(store.dialogStack).toHaveLength(0)
      expect(store.isDialogOpen('test-dialog')).toBe(false)
    })

    it('should reuse existing dialog when showing with same key', () => {
      const store = useDialogStore()

      store.showDialog({
        key: 'reusable-dialog',
        component: MockComponent,
        title: 'Original Title'
      })

      // First call should create the dialog
      expect(store.dialogStack).toHaveLength(1)
      expect(store.dialogStack[0].title).toBe('Original Title')

      // Second call with same key should reuse the dialog
      store.showDialog({
        key: 'reusable-dialog',
        component: MockComponent,
        title: 'New Title' // This should be ignored
      })

      // Should still have only one dialog with original title
      expect(store.dialogStack).toHaveLength(1)
      expect(store.dialogStack[0].key).toBe('reusable-dialog')
      expect(store.dialogStack[0].title).toBe('Original Title')
    })

    it('should update existing dialog props by key', () => {
      const store = useDialogStore()

      store.showDialog({
        key: 'updatable-dialog',
        component: MockContentPropsComponent,
        props: { openingAction: null },
        dialogComponentProps: { dismissableMask: true }
      })

      const updated = store.updateDialog({
        key: 'updatable-dialog',
        contentProps: { openingAction: 'copy-and-open' },
        dialogComponentProps: { dismissableMask: false }
      })

      expect(updated).toBe(true)
      expect(store.dialogStack[0].contentProps).toMatchObject({
        openingAction: 'copy-and-open'
      })
      expect(store.dialogStack[0].dialogComponentProps.dismissableMask).toBe(
        false
      )
    })

    it('updates only content props when dialog component props are omitted', () => {
      const store = useDialogStore()

      store.showDialog({
        key: 'content-only',
        component: MockContentPropsComponent,
        props: { openingAction: null }
      })

      expect(
        store.updateDialog({
          key: 'content-only',
          contentProps: { openingAction: 'open' }
        })
      ).toBe(true)
      expect(store.dialogStack[0].contentProps.openingAction).toBe('open')
    })

    it('updates only dialog component props when content props are omitted', () => {
      const store = useDialogStore()

      store.showDialog({
        key: 'dialog-props-only',
        component: MockContentPropsComponent,
        dialogComponentProps: { dismissableMask: true }
      })

      expect(
        store.updateDialog({
          key: 'dialog-props-only',
          dialogComponentProps: { dismissableMask: false }
        })
      ).toBe(true)
      expect(store.dialogStack[0].dialogComponentProps.dismissableMask).toBe(
        false
      )
    })

    it('returns false when updating a missing dialog', () => {
      const store = useDialogStore()

      expect(
        store.updateDialog({
          key: 'missing',
          contentProps: { openingAction: 'open' }
        })
      ).toBe(false)
    })

    it('creates and reuses extension dialogs with extension-prefixed keys', () => {
      const store = useDialogStore()

      const first = store.showExtensionDialog({
        key: 'external',
        component: MockComponent
      })
      const second = store.showExtensionDialog({
        key: 'extension-external',
        component: MockComponent
      })

      expect(first?.key).toBe('extension-external')
      expect(second?.key).toBe(first?.key)
      expect(store.dialogStack).toHaveLength(1)
    })

    it('rejects extension dialogs without keys', () => {
      const store = useDialogStore()
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})

      const dialog = store.showExtensionDialog({
        key: '',
        component: MockComponent
      })

      expect(dialog).toBeUndefined()
      expect(error).toHaveBeenCalledWith('Extension dialog key is required')
      error.mockRestore()
    })
  })

  describe('ESC key behavior with multiple dialogs', () => {
    it('should only allow the active dialog to close with ESC key', () => {
      const store = useDialogStore()

      // Create dialogs with different priorities
      store.showDialog({
        key: 'dialog-1',
        component: MockComponent,
        priority: 1
      })

      store.showDialog({
        key: 'dialog-2',
        component: MockComponent,
        priority: 2
      })

      store.showDialog({
        key: 'dialog-3',
        component: MockComponent,
        priority: 3
      })

      // Only the active dialog should be closable with ESC
      const activeDialog = store.dialogStack.find(
        (d) => d.key === store.activeKey
      )
      const inactiveDialogs = store.dialogStack.filter(
        (d) => d.key !== store.activeKey
      )

      expect(activeDialog?.dialogComponentProps.closeOnEscape).toBe(true)
      inactiveDialogs.forEach((dialog) => {
        expect(dialog.dialogComponentProps.closeOnEscape).toBe(false)
      })

      // Close the active dialog
      store.closeDialog({ key: store.activeKey! })

      // The new active dialog should now be closable with ESC
      const newActiveDialog = store.dialogStack.find(
        (d) => d.key === store.activeKey
      )
      const newInactiveDialogs = store.dialogStack.filter(
        (d) => d.key !== store.activeKey
      )

      expect(newActiveDialog?.dialogComponentProps.closeOnEscape).toBe(true)
      newInactiveDialogs.forEach((dialog) => {
        expect(dialog.dialogComponentProps.closeOnEscape).toBe(false)
      })
    })
  })
})
