import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'

import PanelHeader from './PanelHeader.vue'

function mount(isMaximized = false) {
  return render(PanelHeader, {
    props: { isMaximized },
    global: {
      plugins: [PrimeVue, i18n],
      directives: { tooltip: Tooltip }
    }
  })
}

describe('PanelHeader', () => {
  it.for([
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
        await screen.findByRole('tooltip', { hidden: true })
      ).toHaveTextContent(label)
    }
  )
})
