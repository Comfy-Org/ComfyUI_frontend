import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { HideLayoutFieldKey } from '@/types/widgetTypes'

import WidgetLayoutField from './WidgetLayoutField.vue'

type WidgetShape = Pick<
  SimplifiedWidget<string>,
  'name' | 'label' | 'borderStyle'
>

function renderField(
  widget: WidgetShape,
  {
    hideLayoutField = false,
    slotContent = '<span data-testid="slot">content</span>'
  }: {
    hideLayoutField?: boolean
    slotContent?: string
  } = {}
) {
  const Harness = defineComponent({
    components: { WidgetLayoutField },
    setup: () => ({ widget }),
    template: `<WidgetLayoutField :widget input-id="field-input">${slotContent}</WidgetLayoutField>`
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
        setup: () => ({ count: ref(0), disabled, widget: { name: 'field' } }),
        template: `
          <WidgetLayoutField data-testid="row" :widget="widget" input-id="primary">
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

    it('renders the label area without text when widget.name is empty', () => {
      renderField({ name: '' })
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

  // user-event models clicks/keyboard but not raw pointerdown/move/up.
  // fireEvent is the correct primitive for testing propagation stops on
  // pointer events, so the testing-library/prefer-user-event rule is
  // disabled within this block.
  /* oxlint-disable testing-library/prefer-user-event */
  describe('Pointer-event isolation', () => {
    // The slot wrapper stops pointerdown/move/up so inner controls can capture
    // drags without triggering node selection/drag on the outer canvas.
    function renderInsideParent(onParentPointer: (type: string) => void) {
      const Harness = defineComponent({
        components: { WidgetLayoutField },
        setup: () => ({
          widget: { name: 'seed' },
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
            <WidgetLayoutField :widget="widget">
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
          widget: { name: 'seed' },
          onParent: (t: string) => parentSpy(t),
          onInner: () => innerSpy()
        }),
        template: `
          <div data-testid="parent" @pointerdown="onParent('pointerdown')">
            <WidgetLayoutField :widget="widget">
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
