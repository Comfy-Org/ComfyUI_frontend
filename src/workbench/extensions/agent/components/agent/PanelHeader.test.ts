import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import PanelHeader from './PanelHeader.vue'

function mount(isMaximized = false) {
  return render(PanelHeader, {
    props: { isMaximized },
    global: {
      plugins: [i18n]
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
  ] as const)(
    'shows the %s panel tooltip for %s',
    async ([isMaximized, label]) => {
      mount(isMaximized)

      await userEvent.hover(screen.getByRole('button', { name: label }))
      expect(
        await screen.findByText(label, {
          selector: '[data-slot="tooltip-content"]'
        })
      ).toBeVisible()
    }
  )

  it('asks to restart the onboarding tour from the info button', async () => {
    const { emitted } = mount()

    await userEvent.click(screen.getByRole('button', { name: 'Take the tour' }))

    expect(emitted('startTour')).toHaveLength(1)
  })
})
