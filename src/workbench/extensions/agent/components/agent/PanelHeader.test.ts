import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { DirectiveBinding } from 'vue'

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
  it('exposes the heading id the dock landmark labels', () => {
    mount()

    expect(
      screen.getByRole('heading', { name: 'Comfy Agent' })
    ).toHaveAttribute('id', 'agent-panel-title')
  })

  it.for([
    [false, 'Take the tour'],
    [false, 'New chat'],
    [false, 'Maximize panel'],
    [true, 'Minimize panel'],
    [false, 'Close']
  ] as const)('shows the %s panel tooltip for %s', ([isMaximized, label]) => {
    mount(isMaximized)

    const button = screen.getByRole('button', { name: label })
    expect(tooltipBindings.get(button)).toMatchObject({ value: label })
  })

  it('asks to restart the onboarding tour from the info button', async () => {
    const { emitted } = mount()

    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }))

    expect(emitted('startTour')).toHaveLength(1)
  })
})
