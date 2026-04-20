/* eslint-disable vue/one-component-per-file */
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
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

  // user-event models clicks/keyboard but not raw pointerdown/move/up.
  // fireEvent is the correct primitive for testing propagation stops on
  // pointer events, so the testing-library/prefer-user-event rule is
  // disabled within this block.
  /* eslint-disable testing-library/prefer-user-event */
  describe('Pointer-event isolation', () => {
    // The slot wrapper stops pointerdown/move/up so inner controls can capture
    // drags without triggering node selection/drag on the outer canvas.
    function renderInsideParent(
      onParentPointer: (type: string) => void
    ) {
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
  /* eslint-enable testing-library/prefer-user-event */
})
