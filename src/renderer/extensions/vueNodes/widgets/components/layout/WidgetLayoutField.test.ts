/* eslint-disable vue/one-component-per-file */
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import { HideLayoutFieldKey } from '@/types/widgetTypes'

import WidgetLayoutField from './WidgetLayoutField.vue'

type WidgetShape = {
  name: string
  label?: string
  borderStyle?: string
}

function renderField(
  widget: WidgetShape,
  {
    hideLayoutField = false,
    slotContent = '<span data-testid="slot">content</span>'
  }: { hideLayoutField?: boolean; slotContent?: string } = {}
) {
  const Harness = defineComponent({
    components: { WidgetLayoutField },
    setup: () => ({ widget }),
    template: `<WidgetLayoutField :widget="widget">${slotContent}</WidgetLayoutField>`
  })
  return render(Harness, {
    global: {
      provide: { [HideLayoutFieldKey as symbol]: hideLayoutField }
    }
  })
}

describe('WidgetLayoutField', () => {
  describe('Label rendering', () => {
    it('renders widget.name when label is absent', () => {
      renderField({ name: 'seed' })
      expect(screen.getByText('seed')).toBeInTheDocument()
    })

    it('prefers widget.label over widget.name', () => {
      renderField({ name: 'seed', label: 'Random Seed' })
      expect(screen.getByText('Random Seed')).toBeInTheDocument()
      expect(screen.queryByText('seed')).toBeNull()
    })

    it('renders no label when widget.name is empty', () => {
      renderField({ name: '' })
      expect(screen.queryByText('seed')).toBeNull()
    })
  })

  describe('HideLayoutField injection', () => {
    it('shows the label area by default', () => {
      renderField({ name: 'seed' })
      expect(screen.getByText('seed')).toBeInTheDocument()
    })

    it('hides the label area when HideLayoutFieldKey is true', () => {
      renderField({ name: 'seed' }, { hideLayoutField: true })
      expect(screen.queryByText('seed')).toBeNull()
    })

    it('still renders the slotted content when the label is hidden', () => {
      renderField({ name: 'seed' }, { hideLayoutField: true })
      expect(screen.getByTestId('slot')).toBeInTheDocument()
    })
  })

  describe('Slot content', () => {
    it('renders the default slot', () => {
      renderField({ name: 'seed' })
      expect(screen.getByTestId('slot')).toBeInTheDocument()
    })

    it('passes borderStyle to the default slot', () => {
      const Harness = defineComponent({
        components: { WidgetLayoutField },
        setup: () => ({
          widget: { name: 'seed', borderStyle: 'custom-border' }
        }),
        template: `
          <WidgetLayoutField :widget="widget">
            <template #default="{ borderStyle }">
              <span data-testid="slot-border" :data-border="borderStyle" />
            </template>
          </WidgetLayoutField>
        `
      })
      render(Harness)
      const el = screen.getByTestId('slot-border')
      expect(el.dataset.border).toContain('custom-border')
    })
  })
})
