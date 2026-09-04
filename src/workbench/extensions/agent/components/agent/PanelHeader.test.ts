import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import type { DirectiveBinding } from 'vue'

import * as tooltipConfig from '@/composables/useTooltipConfig'
import { i18n } from '@/i18n'

import PanelHeader from './PanelHeader.vue'

const tooltipBindings = new WeakMap<Element, unknown>()
const tooltipDirectiveStub = {
  mounted(element: Element, binding: DirectiveBinding<unknown>) {
    tooltipBindings.set(element, binding.value)
  },
  updated(element: Element, binding: DirectiveBinding<unknown>) {
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
  it('exposes the test id and the heading id the dock landmark labels', () => {
    mount()

    const heading = screen.getByTestId('agent-panel-title')
    expect(heading).toHaveAttribute('id', 'agent-panel-title')
  })

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
    mount(isMaximized)

    const button = screen.getByRole('button', { name: label })
    expect(tooltipBindings.get(button)).toEqual(
      tooltipConfig.buildAgentTooltipConfig(label)
    )
  })
})
