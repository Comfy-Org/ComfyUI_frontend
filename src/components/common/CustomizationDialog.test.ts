import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import CustomizationDialog from './CustomizationDialog.vue'

const DEFAULT_ICON = 'pi-bookmark-fill'
const DEFAULT_COLOR = '#a1a1aa'

vi.mock('@/stores/nodeBookmarkStore', () => ({
  useNodeBookmarkStore: () => ({
    defaultBookmarkIcon: DEFAULT_ICON,
    defaultBookmarkColor: DEFAULT_COLOR,
    bookmarksCustomization: {}
  })
}))

vi.mock('primevue/dialog', () => ({
  default: {
    name: 'Dialog',
    template: '<div v-if="visible"><slot /><slot name="footer" /></div>',
    props: ['visible']
  }
}))

vi.mock('primevue/selectbutton', () => ({
  default: {
    name: 'SelectButton',
    template: '<div />',
    props: ['modelValue', 'options']
  }
}))

vi.mock('primevue/divider', () => ({
  default: { name: 'Divider', template: '<hr />' }
}))

vi.mock('@/components/common/ColorCustomizationSelector.vue', () => ({
  default: {
    name: 'ColorCustomizationSelector',
    template: '<div />',
    props: ['modelValue', 'colorOptions']
  }
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    name: 'Button',
    template: `<button @click="$emit('click')"><slot /></button>`,
    emits: ['click']
  }
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

function renderDialog(extraProps: Record<string, unknown> = {}) {
  const onConfirm = vi.fn()
  render(CustomizationDialog, {
    global: { plugins: [i18n] },
    props: { modelValue: true, onConfirm, ...extraProps }
  })
  return { onConfirm }
}

describe('CustomizationDialog', () => {
  describe('confirmCustomization', () => {
    it('emits confirm with default icon and color when no initial values provided', async () => {
      const user = userEvent.setup()
      const { onConfirm } = renderDialog()

      await user.click(screen.getByText('g.confirm'))

      expect(onConfirm).toHaveBeenCalledWith(DEFAULT_ICON, DEFAULT_COLOR)
    })

    it('emits confirm with matching initialIcon when provided', async () => {
      const user = userEvent.setup()
      const { onConfirm } = renderDialog({ initialIcon: 'pi-star' })

      await user.click(screen.getByText('g.confirm'))

      expect(onConfirm).toHaveBeenCalledWith('pi-star', DEFAULT_COLOR)
    })

    it('falls back to default icon when initialIcon does not match any option', async () => {
      const user = userEvent.setup()
      const { onConfirm } = renderDialog({ initialIcon: 'pi-nonexistent' })

      await user.click(screen.getByText('g.confirm'))

      expect(onConfirm).toHaveBeenCalledWith(DEFAULT_ICON, DEFAULT_COLOR)
    })

    it('emits confirm with initialColor when provided', async () => {
      const user = userEvent.setup()
      const { onConfirm } = renderDialog({ initialColor: '#007bff' })

      await user.click(screen.getByText('g.confirm'))

      expect(onConfirm).toHaveBeenCalledWith(DEFAULT_ICON, '#007bff')
    })
  })
})
