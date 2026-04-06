import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import JobContextMenu from '@/components/queue/job/JobContextMenu.vue'
import type { MenuEntry } from '@/composables/queue/useJobMenu'

const popoverStub = defineComponent({
  name: 'Popover',
  emits: ['show', 'hide'],
  data() {
    return {
      visible: false,
      container: null as HTMLElement | null,
      eventTarget: null as EventTarget | null,
      target: null as EventTarget | null
    }
  },
  mounted() {
    this.container = this.$refs.container as HTMLElement | null
  },
  updated() {
    this.container = this.$refs.container as HTMLElement | null
  },
  methods: {
    toggle(event: Event, target?: EventTarget | null) {
      if (this.visible) {
        this.hide()
        return
      }

      this.show(event, target)
    },
    show(event: Event, target?: EventTarget | null) {
      this.visible = true
      this.eventTarget = event.currentTarget
      this.target = target ?? event.currentTarget
      this.$emit('show')
    },
    hide() {
      this.visible = false
      this.$emit('hide')
    }
  },
  template: `
    <div v-if="visible" ref="container" class="popover-stub">
      <slot />
    </div>
  `
})

const buttonStub = {
  props: {
    disabled: {
      type: Boolean,
      default: false
    }
  },
  template: `
    <div
      class="button-stub"
      :data-disabled="String(disabled)"
    >
      <slot />
    </div>
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
    props: { entries },
    global: {
      stubs: {
        Popover: popoverStub,
        Button: buttonStub
      }
    }
  })

const createTriggerEvent = (type: string, currentTarget: EventTarget) =>
  ({
    type,
    currentTarget,
    target: currentTarget
  }) as Event

const openMenu = async (
  wrapper: ReturnType<typeof mountComponent>,
  type: string = 'click'
) => {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  await wrapper.vm.open(createTriggerEvent(type, trigger))
  await nextTick()
  return trigger
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('JobContextMenu', () => {
  it('passes disabled state to action buttons', async () => {
    const wrapper = mountComponent(createEntries())
    await openMenu(wrapper)

    const buttons = wrapper.findAll('.button-stub')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].attributes('data-disabled')).toBe('false')
    expect(buttons[1].attributes('data-disabled')).toBe('true')

    wrapper.unmount()
  })

  it('emits action for enabled entries', async () => {
    const entries = createEntries()
    const wrapper = mountComponent(entries)
    await openMenu(wrapper)

    await wrapper.findAll('.button-stub')[0].trigger('click')

    expect(wrapper.emitted('action')).toEqual([[entries[0]]])

    wrapper.unmount()
  })

  it('does not emit action for disabled entries', async () => {
    const wrapper = mountComponent([
      {
        key: 'disabled',
        label: 'Disabled action',
        disabled: true,
        onClick: vi.fn()
      }
    ])
    await openMenu(wrapper)

    await wrapper.get('.button-stub').trigger('click')

    expect(wrapper.emitted('action')).toBeUndefined()

    wrapper.unmount()
  })

  it('hides on pointerdown outside the popover', async () => {
    const wrapper = mountComponent(createEntries())
    const trigger = document.createElement('button')
    const outside = document.createElement('div')
    document.body.append(trigger, outside)

    await wrapper.vm.open(createTriggerEvent('contextmenu', trigger))
    await nextTick()
    expect(wrapper.find('.popover-stub').exists()).toBe(true)

    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('.popover-stub').exists()).toBe(false)

    wrapper.unmount()
  })

  it('keeps the menu open through trigger pointerdown and closes on same trigger click', async () => {
    const wrapper = mountComponent(createEntries())
    const trigger = document.createElement('button')
    document.body.append(trigger)

    await wrapper.vm.open(createTriggerEvent('click', trigger))
    await nextTick()
    expect(wrapper.find('.popover-stub').exists()).toBe(true)

    trigger.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await nextTick()

    expect(wrapper.find('.popover-stub').exists()).toBe(true)

    await wrapper.vm.open(createTriggerEvent('click', trigger))
    await nextTick()

    expect(wrapper.find('.popover-stub').exists()).toBe(false)

    wrapper.unmount()
  })
})
