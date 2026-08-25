import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'

const WidgetStub = {
  props: ['widget'],
  template:
    '<button data-testid="widget" :data-linked-display="widget.linkedDisplay" :inert="widget.linkedDisplay ? true : undefined" />'
}

const AppInputStub = {
  props: ['enable'],
  template: '<div data-testid="app-input" :data-enabled="enable"><slot /></div>'
}

function linkedWidget(handleContextMenu = vi.fn()): WidgetGridItem {
  return {
    simplified: {
      name: 'prompt',
      type: 'text',
      value: 'stale local prompt',
      options: { disabled: true },
      linkedDisplay: 'control'
    },
    vueComponent: WidgetStub,
    visible: true,
    renderKey: 'prompt:text',
    handleContextMenu
  }
}

function renderGrid(widget: WidgetGridItem) {
  return render(WidgetGrid, {
    props: {
      processedWidgets: [widget],
      nodeType: 'TestNode',
      canSelectInputs: true
    },
    global: {
      stubs: { AppInput: AppInputStub },
      directives: { tooltip: {} }
    }
  })
}

describe('WidgetGrid', () => {
  it('mounts a linked standard widget as an inert disabled control', () => {
    renderGrid(linkedWidget())

    expect(screen.getByTestId('app-input')).toHaveAttribute(
      'data-enabled',
      'false'
    )
    expect(screen.getByTestId('widget')).toHaveAttribute(
      'data-linked-display',
      'control'
    )
    expect(screen.getByTestId('widget')).toHaveAttribute('inert')
  })

  it('dispatches context menu actions around an inert linked widget', async () => {
    const handleContextMenu = vi.fn()
    renderGrid(linkedWidget(handleContextMenu))

    await fireEvent.contextMenu(screen.getByTestId('app-input'))

    expect(handleContextMenu).toHaveBeenCalledOnce()
  })
})
