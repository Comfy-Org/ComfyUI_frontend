import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import type { DirectiveBinding } from 'vue'

import * as tooltipConfig from '@/composables/useTooltipConfig'
import { i18n } from '@/i18n'

import PanelHeader from './PanelHeader.vue'

const tooltipBindings = new WeakMap<Element, DirectiveBinding['value']>()
const tooltipDirectiveStub = {
  mounted(element: Element, binding: DirectiveBinding) {
    tooltipBindings.set(element, binding.value)
  },
  updated(element: Element, binding: DirectiveBinding) {
    tooltipBindings.set(element, binding.value)
  }
}

function mount(isMaximized = false) {
  return render(PanelHeader, {
    props: { isMaximized },
    global: {
      plugins: [i18n],
      directives: { tooltip: tooltipDirectiveStub }
    }
  })
}

describe('PanelHeader', () => {
  it('passes the full tooltip config to the button directive', () => {
    mount()

    const button = screen.getByRole('button', { name: 'New chat' })
    expect(tooltipBindings.get(button)).toEqual(
      tooltipConfig.buildAgentTooltipConfig('New chat')
    )
  })

  it.for([
    [false, 'New chat'],
    [false, 'Maximize panel'],
    [true, 'Minimize panel'],
    [false, 'Close']
  ] as const)('shows the %s panel tooltip for %s', ([isMaximized, label]) => {
    const spy = vi.spyOn(tooltipConfig, 'buildAgentTooltipConfig')

    mount(isMaximized)

    expect(spy).toHaveBeenCalledWith(label)
  })
})
