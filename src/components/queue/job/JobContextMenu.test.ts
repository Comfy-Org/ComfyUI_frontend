import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import JobContextMenu from '@/components/queue/job/JobContextMenu.vue'
import type { MenuEntry } from '@/composables/queue/useJobMenu'

const buttonStub = {
  props: {
    disabled: {
      type: Boolean,
      default: false
    }
  },
  template: `
    <button
      class="button-stub"
      type="button"
      :data-disabled="String(disabled)"
      :disabled="disabled"
    >
      <slot />
    </button>
  `
}

const createEntries = (): MenuEntry[] => [
  { key: 'enabled', label: 'Enabled action', onClick: vi.fn() },
  {
    key: 'disabled',
    label: 'Disabled action',
    disabled: true,
    onClick: vi.fn()
  },
  { kind: 'divider', key: 'divider-1' }
]

const mountComponent = (entries: MenuEntry[]) =>
  mount(JobContextMenu, {
    attachTo: document.body,
    props: { entries },
    slots: {
      default: '<button class="context-trigger" type="button">Trigger</button>'
    },
    global: {
      stubs: {
        Button: buttonStub
      }
    }
  })

const openMenu = async () => {
  const trigger = document.body.querySelector('.context-trigger')
  trigger?.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2
    })
  )
  await waitForMenuUpdate()
}

const getRenderedButtons = () =>
  Array.from(document.body.querySelectorAll<HTMLButtonElement>('.button-stub'))

const isMenuVisible = () =>
  document.body.querySelector('.job-context-menu-content') !== null

const waitForMenuUpdate = async () => {
  await nextTick()
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('JobContextMenu', () => {
  it('passes disabled state to action buttons', async () => {
    const wrapper = mountComponent(createEntries())
    await openMenu()

    const buttons = getRenderedButtons()
    expect(buttons).toHaveLength(2)
    expect(buttons[0].disabled).toBe(false)
    expect(buttons[1].disabled).toBe(true)

    wrapper.unmount()
  })

  it('emits action for enabled entries', async () => {
    const entries = createEntries()
    const wrapper = mountComponent(entries)
    await openMenu()

    getRenderedButtons()[0].click()
    await waitForMenuUpdate()

    expect(wrapper.emitted('action')).toEqual([[entries[0]]])
    expect(isMenuVisible()).toBe(false)

    wrapper.unmount()
  })

  it('opens from the slotted context-menu trigger', async () => {
    const wrapper = mountComponent(createEntries())
    await openMenu()

    expect(isMenuVisible()).toBe(true)
    expect(
      document.body.querySelectorAll('[role="menuitem"]').length
    ).toBeGreaterThan(0)

    wrapper.unmount()
  })
})
