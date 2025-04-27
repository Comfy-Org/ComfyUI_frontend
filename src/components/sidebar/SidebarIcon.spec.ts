import { mount } from '@vue/test-utils'
import Button from 'primevue/button'
import PrimeVue from 'primevue/config'
import OverlayBadge from 'primevue/overlaybadge'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it } from 'vitest'

import SidebarIcon from './SidebarIcon.vue'

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

  it('renders label', () => {
    const wrapper = mountSidebarIcon({})
    expect(wrapper.find('.p-button.p-component').exists()).toBe(true)
    expect(wrapper.find('.p-button-label').exists()).toBe(true)
  })

  it('renders icon', () => {
    const wrapper = mountSidebarIcon({})
    expect(wrapper.find('.p-button-icon-only').exists()).toBe(true)
  })

  it('creates badge when iconBadge prop is set', () => {
    const badge = '2'
    const wrapper = mountSidebarIcon({ iconBadge: badge })
    const badgeEl = wrapper.findComponent(OverlayBadge)
    expect(badgeEl.exists()).toBe(true)
    expect(badgeEl.find('.p-badge').text()).toEqual(badge)
  })

  it('shows tooltip on hover', async () => {
    const tooltipShowDelay = 300
    const tooltipText = 'Settings'
    const wrapper = mountSidebarIcon({ tooltip: tooltipText })

    const tooltipElBeforeHover = document.querySelector('[role="tooltip"]')
    expect(tooltipElBeforeHover).toBeNull()

    // Hover over the icon
    await wrapper.trigger('mouseenter')
    await new Promise((resolve) => setTimeout(resolve, tooltipShowDelay + 16))

    const tooltipElAfterHover = document.querySelector('[role="tooltip"]')
    expect(tooltipElAfterHover).not.toBeNull()
  })

  it('sets aria-label attribute when tooltip is provided', () => {
    const tooltipText = 'Settings'
    const wrapper = mountSidebarIcon({ tooltip: tooltipText })
    expect(wrapper.attributes('aria-label')).toEqual(tooltipText)
  })
})
