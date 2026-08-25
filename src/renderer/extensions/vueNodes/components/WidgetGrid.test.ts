import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'

const WidgetStub = {
  props: ['widget'],
  template: '<button data-testid="widget" />'
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
  it('disables input promotion for a linked widget', () => {
    renderGrid(linkedWidget())

    expect(screen.getByTestId('app-input')).toHaveAttribute(
      'data-enabled',
      'false'
    )
  })

  it('dispatches context menu actions around an inert linked widget', async () => {
    const handleContextMenu = vi.fn()
    renderGrid(linkedWidget(handleContextMenu))

    await fireEvent.contextMenu(screen.getByTestId('app-input'))

    expect(handleContextMenu).toHaveBeenCalledOnce()
  })
})
