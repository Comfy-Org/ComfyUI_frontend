import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import { registerTestWidget } from '@/renderer/extensions/vueNodes/widgets/components/widgetTestUtils'
import { AdvancedWidgetRingKey, HideLayoutFieldKey } from '@/types/widgetTypes'

import WidgetLayoutField from './WidgetLayoutField.vue'

function renderField(
  widget: { name: string; label?: string },
  {
    hideLayoutField = false,
    displayLabel,
    slotContent = '<span data-testid="slot">content</span>'
  }: {
    hideLayoutField?: boolean
    displayLabel?: string
    slotContent?: string
  } = {}
) {
  const widgetId = registerTestWidget({ ...widget, value: undefined })
  const Harness = defineComponent({
    components: { WidgetLayoutField },
    setup: () => ({ widgetId, displayLabel }),
    template: `<WidgetLayoutField :widget-id :display-label input-id="field-input">${slotContent}</WidgetLayoutField>`
  })
  return render(Harness, {
    global: {
      provide: {
        [HideLayoutFieldKey as symbol]: hideLayoutField
      }
    }
  })
}

describe('WidgetLayoutField', () => {
  it.for([
    { target: 'row', disabled: false, expected: '1' },
    { target: 'row', disabled: true, expected: '0' },
    { target: 'primary', disabled: false, expected: '1' },
    { target: 'secondary', disabled: false, expected: '0' }
  ] as const)(
    'activates $target with disabled=$disabled',
    async ({ target, disabled, expected }) => {
      const user = userEvent.setup()
      const Harness = defineComponent({
        components: { WidgetLayoutField },
        setup: () => ({
          count: ref(0),
          disabled,
          widgetId: registerTestWidget({ name: 'field', value: undefined })
        }),
        template: `
          <WidgetLayoutField data-testid="row" :widget-id input-id="primary">
            <button id="primary" :disabled="disabled" @click="count++">Primary</button>
            <button>Secondary</button>
            <output data-testid="count">{{ count }}</output>
          </WidgetLayoutField>
        `
      })
      render(Harness)
      const targets = {
        row: screen.getByTestId('widget-row-hit-area'),
        primary: screen.getByRole('button', { name: 'field' }),
        secondary: screen.getByRole('button', { name: 'Secondary' })
      }

      await user.click(targets[target])

      expect(screen.getByTestId('count')).toHaveTextContent(expected)
    }
  )

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

    it('renders the label area without text when the display label is empty', () => {
      renderField({ name: 'seed' }, { displayLabel: '' })
      expect(screen.getByTestId('widget-layout-field-label')).toHaveTextContent(
        ''
      )
      expect(screen.getByTestId('slot')).toBeInTheDocument()
    })
  })

  describe('Label visibility', () => {
    it('shows the label area by default', () => {
      renderField({ name: 'seed' })
      expect(
        screen.getByTestId('widget-layout-field-label')
      ).toBeInTheDocument()
    })

    it('hides the label area when HideLayoutFieldKey is true', () => {
      renderField({ name: 'seed' }, { hideLayoutField: true })
      expect(screen.queryByTestId('widget-layout-field-label')).toBeNull()
    })

    it('preserves the control name when the label is hidden', () => {
      renderField(
        { name: 'ckpt_name' },
        {
          hideLayoutField: true,
          slotContent: '<button id="field-input">model.safetensors</button>'
        }
      )
      expect(
        screen.getByRole('button', { name: 'model.safetensors' })
      ).toBeInTheDocument()
    })
  })

  describe('Slot content', () => {
    it('passes the advanced ring borderStyle to the default slot', () => {
      const Harness = defineComponent({
        components: { WidgetLayoutField },
        setup: () => ({
          widgetId: registerTestWidget({
            name: 'seed',
            value: undefined,
            options: { advanced: true }
          })
        }),
        template: `
          <WidgetLayoutField :widget-id>
            <template #default="{ borderStyle }">
              <span data-testid="slot-border" :data-border="borderStyle" />
            </template>
          </WidgetLayoutField>
        `
      })
      render(Harness, {
        global: { provide: { [AdvancedWidgetRingKey]: true } }
      })
      const el = screen.getByTestId('slot-border')
      expect(el.dataset.border).toContain('ring-primary')
    })
  })

  /* oxlint-disable testing-library/prefer-user-event */
  describe('Pointer-event isolation', () => {
    function renderInsideParent(onParentPointer: (type: string) => void) {
      const Harness = defineComponent({
        components: { WidgetLayoutField },
        setup: () => ({
          widgetId: registerTestWidget({ name: 'seed', value: undefined }),
          onDown: () => onParentPointer('pointerdown'),
          onMove: () => onParentPointer('pointermove'),
          onUp: () => onParentPointer('pointerup')
        }),
        template: `
          <div
            data-testid="parent"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
          >
            <WidgetLayoutField :widget-id>
              <input data-testid="inner-input" />
            </WidgetLayoutField>
          </div>
        `
      })
      return render(Harness)
    }

    it.for([
      ['pointerdown', fireEvent.pointerDown],
      ['pointermove', fireEvent.pointerMove],
      ['pointerup', fireEvent.pointerUp]
    ] as const)(
      'stops %s from propagating to the parent',
      async ([, dispatch]) => {
        const parentSpy = vi.fn<(type: string) => void>()
        renderInsideParent(parentSpy)

        const inner = screen.getByTestId('inner-input')
        await dispatch(inner)

        expect(parentSpy).not.toHaveBeenCalled()
      }
    )

    it('still allows the inner control itself to observe the event', async () => {
      const parentSpy = vi.fn<(type: string) => void>()
      const innerSpy = vi.fn()
      const Harness = defineComponent({
        components: { WidgetLayoutField },
        setup: () => ({
          widgetId: registerTestWidget({ name: 'seed', value: undefined }),
          onParent: (t: string) => parentSpy(t),
          onInner: () => innerSpy()
        }),
        template: `
          <div data-testid="parent" @pointerdown="onParent('pointerdown')">
            <WidgetLayoutField :widget-id>
              <input data-testid="inner-input" @pointerdown="onInner" />
            </WidgetLayoutField>
          </div>
        `
      })
      render(Harness)

      await fireEvent.pointerDown(screen.getByTestId('inner-input'))

      expect(innerSpy).toHaveBeenCalledTimes(1)
      expect(parentSpy).not.toHaveBeenCalled()
    })
  })
  /* oxlint-enable testing-library/prefer-user-event */
})
