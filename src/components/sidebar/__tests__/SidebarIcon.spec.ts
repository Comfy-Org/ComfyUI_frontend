import { mount } from '@vue/test-utils'
import { expect, describe, it } from 'vitest'
import SidebarIcon from '../SidebarIcon.vue'
import OverlayBadge from 'primevue/overlaybadge'
import Button from 'primevue/button'
import Tooltip from 'primevue/tooltip'
import PrimeVue from 'primevue/config'

type SidebarIconProps = {
  icon: string
  selected: boolean
  tooltip?: string
  class?: string
  iconBadge?: string | (() => string | null)
}

describe('SidebarIcon', () => {
  const exampleProps: SidebarIconProps = {
    icon: 'pi pi-cog',
    selected: false
  }

  const mountSidebarIcon = (props: Partial<SidebarIconProps>, options = {}) => {
    return mount(SidebarIcon, {
      global: {
        plugins: [PrimeVue],
        directives: { tooltip: Tooltip },
        components: { OverlayBadge, Button }
      },
      props: { ...exampleProps, ...props },
      ...options
    })
  }

  it('shows tooltip on hover', async () => {
    const tooltipShowDelay = 300
    const tooltipText = 'Settings'
    const wrapper = mountSidebarIcon({ tooltip: tooltipText })

    const tooltip = document.querySelector('[role="tooltip"]')
    expect(tooltip).toBeNull()

    // Hover over the icon
    await wrapper.trigger('mouseenter')
    await new Promise((resolve) => setTimeout(resolve, tooltipShowDelay + 16))

    const tooltipAfterHover = document.querySelector('[role="tooltip"]')
    expect(tooltipAfterHover).not.toBeNull()
  })

  it('sets aria-label attribute when tooltip is provided', () => {
    const tooltipText = 'Settings'
    const wrapper = mountSidebarIcon({ tooltip: tooltipText })
    expect(wrapper.attributes('aria-label')).toEqual(tooltipText)
  })
})
