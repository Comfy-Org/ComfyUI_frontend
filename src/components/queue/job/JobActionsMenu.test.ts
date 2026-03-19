import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import JobActionsMenu from '@/components/queue/job/JobActionsMenu.vue'
import type { MenuEntry } from '@/composables/queue/useJobMenu'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

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
      v-bind="$attrs"
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
  }
]

const mountComponent = (entries: MenuEntry[]) =>
  mount(JobActionsMenu, {
    attachTo: document.body,
    props: { entries },
    global: {
      stubs: {
        Button: buttonStub
      }
    }
  })

const getTriggerButton = () =>
  document.body.querySelector<HTMLButtonElement>('.job-actions-menu-trigger')

const getMenuButtons = () =>
  Array.from(
    document.body.querySelectorAll<HTMLButtonElement>(
      '.job-menu-panel .button-stub'
    )
  )

const isMenuVisible = () =>
  document.body.querySelector('.job-menu-panel') !== null

const waitForMenuUpdate = async () => {
  await nextTick()
  await nextTick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('JobActionsMenu', () => {
  it('toggles when the trigger is clicked twice', async () => {
    const wrapper = mountComponent(createEntries())

    getTriggerButton()?.click()
    await waitForMenuUpdate()
    expect(isMenuVisible()).toBe(true)

    getTriggerButton()?.click()
    await waitForMenuUpdate()
    expect(isMenuVisible()).toBe(false)

    wrapper.unmount()
  })

  it('emits the selected action and closes the menu', async () => {
    const entries = createEntries()
    const wrapper = mountComponent(entries)

    getTriggerButton()?.click()
    await waitForMenuUpdate()

    getMenuButtons()[0].click()
    await waitForMenuUpdate()

    expect(wrapper.emitted('action')).toEqual([[entries[0]]])
    expect(isMenuVisible()).toBe(false)

    wrapper.unmount()
  })
})
