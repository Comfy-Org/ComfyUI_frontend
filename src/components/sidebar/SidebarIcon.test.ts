import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import SidebarIcon from './SidebarIcon.vue'

type SidebarIconProps = {
  icon: string
  selected: boolean
  tooltip?: string
  class?: string
  iconBadge?: string | (() => string | null)
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {}
  }
})

describe('SidebarIcon', () => {
  const exampleProps: SidebarIconProps = {
    icon: 'pi pi-cog',
    selected: false
  }

  function renderSidebarIcon(props: Partial<SidebarIconProps> = {}) {
    const user = userEvent.setup()

    const result = render(SidebarIcon, {
      global: {
        plugins: [PrimeVue, i18n],
        directives: { tooltip: Tooltip }
      },
      props: { ...exampleProps, ...props }
    })

    return { ...result, user }
  }

  it('renders button element', () => {
    renderSidebarIcon()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('renders icon', () => {
    const { container } = renderSidebarIcon()
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- Icon escape hatch: iconify icons have no ARIA role
    expect(container.querySelector('.side-bar-button-icon')).not.toBeNull()
  })

  it('creates badge when iconBadge prop is set', () => {
    const badge = '2'
    renderSidebarIcon({ iconBadge: badge })
    expect(screen.getByText(badge)).toBeInTheDocument()
  })

  it('shows tooltip on hover', async () => {
    const tooltipText = 'Settings'
    const { user } = renderSidebarIcon({ tooltip: tooltipText })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await user.hover(screen.getByRole('button'))

    await waitFor(
      () => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })

  it('sets aria-label attribute when tooltip is provided', () => {
    const tooltipText = 'Settings'
    renderSidebarIcon({ tooltip: tooltipText })
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      tooltipText
    )
  })
})
