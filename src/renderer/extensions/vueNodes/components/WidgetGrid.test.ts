/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'

const linkedWidget: WidgetGridItem = {
  simplified: { name: 'steps', type: 'number', value: 20 },
  vueComponent: { template: '<div />' },
  visible: true,
  renderKey: 'steps',
  slotMetadata: { index: 0, linked: true, type: 'number' }
}

describe('WidgetGrid', () => {
  it('keeps a linked slot outside the low-detail widget wrapper', () => {
    const { container } = render(WidgetGrid, {
      props: {
        processedWidgets: [linkedWidget],
        nodeType: 'TestNode'
      },
      global: {
        stubs: {
          AppInput: { template: '<div><slot /></div>' },
          InputSlot: { template: '<div data-testid="input-slot" />' }
        }
      }
    })
    const linkedSlot = container.querySelector('[data-node-lod="show"]')

    expect(linkedSlot).not.toBeNull()
    expect(linkedSlot!.closest('.lg-node-widget')).toBeNull()
    expect(
      linkedSlot!.parentElement?.querySelector('.lg-node-widget')
    ).not.toBeNull()
  })
})
