import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ContextMenu from '@/components/common/ContextMenu.vue'

const mountComponent = ({ closeOnScroll = false } = {}) =>
  mount(ContextMenu, {
    attachTo: document.body,
    props: {
      closeOnScroll,
      contentClass: 'context-menu-content'
    },
    slots: {
      default: '<button class="context-trigger" type="button">Trigger</button>',
      content:
        '<div class="context-menu-content-inner" role="menuitem">Action</div>'
    }
  })

async function openMenu() {
  const trigger = document.body.querySelector('.context-trigger')

  if (!(trigger instanceof HTMLElement)) {
    throw new Error('Context trigger element not found')
  }

  trigger.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2
    })
  )
  await waitForMenuUpdate()
}

const isMenuVisible = () =>
  document.body.querySelector('.context-menu-content-inner') !== null

const waitForMenuUpdate = async () => {
  await nextTick()
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ContextMenu', () => {
  it('opens from the slotted context-menu trigger', async () => {
    const wrapper = mountComponent()
    await openMenu()

    expect(isMenuVisible()).toBe(true)
    expect(
      document.body.querySelectorAll('[role="menuitem"]').length
    ).toBeGreaterThan(0)

    wrapper.unmount()
  })

  it('closes on scroll when enabled', async () => {
    const wrapper = mountComponent({ closeOnScroll: true })
    await openMenu()

    window.dispatchEvent(new Event('scroll'))
    await waitForMenuUpdate()

    expect(isMenuVisible()).toBe(false)

    wrapper.unmount()
  })
})
