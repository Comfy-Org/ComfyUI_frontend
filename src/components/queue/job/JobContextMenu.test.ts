import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

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
    <div v-if="visible" ref="container" data-testid="popover">
      <slot />
    </div>
  `
})

const buttonStub = {
  props: {
    disabled: { type: Boolean, default: false },
    ariaLabel: { type: String, default: undefined }
  },
  template: `
    <button :disabled="disabled" :aria-label="ariaLabel">
      <slot />
    </button>
  `
}

type MenuHandle = { open: (e: Event) => Promise<void>; hide: () => void }

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

const createTriggerEvent = (type: string, currentTarget: EventTarget) =>
  ({
    type,
    currentTarget,
    target: currentTarget
  }) as Event

function renderMenu(entries: MenuEntry[], onAction?: ReturnType<typeof vi.fn>) {
  const menuRef = ref<MenuHandle | null>(null)

  const Wrapper = {
    components: { JobContextMenu },
    setup() {
      return { menuRef, entries }
    },
    template:
      '<JobContextMenu ref="menuRef" :entries="entries" @action="$emit(\'action\', $event)" />'
  }

  const user = userEvent.setup()
  const actionSpy = onAction ?? vi.fn()
  const { unmount } = render(Wrapper, {
    props: { onAction: actionSpy },
    global: {
      stubs: { Popover: popoverStub, Button: buttonStub }
    }
  })

  return { user, menuRef, onAction: actionSpy, unmount }
}

async function openMenu(
  menuRef: ReturnType<typeof ref<MenuHandle | null>>,
  type: string = 'click'
) {
  const trigger = document.createElement('button')
  document.body.append(trigger)
  await menuRef.value!.open(createTriggerEvent(type, trigger))
  await nextTick()
  return trigger
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('JobContextMenu', () => {
  it('passes disabled state to action buttons', async () => {
    const { menuRef, unmount } = renderMenu(createEntries())
    await openMenu(menuRef)

    const enabledBtn = screen.getByRole('button', { name: 'Enabled action' })
    const disabledBtn = screen.getByRole('button', {
      name: 'Disabled action'
    })
    expect(enabledBtn).not.toBeDisabled()
    expect(disabledBtn).toBeDisabled()

    unmount()
  })

  it('emits action for enabled entries', async () => {
    const entries = createEntries()
    const { user, menuRef, onAction, unmount } = renderMenu(entries)
    await openMenu(menuRef)

    await user.click(screen.getByRole('button', { name: 'Enabled action' }))

    expect(onAction).toHaveBeenCalledWith(entries[0])

    unmount()
  })

  it('does not emit action for disabled entries', async () => {
    const { user, menuRef, onAction, unmount } = renderMenu([
      {
        key: 'disabled',
        label: 'Disabled action',
        disabled: true,
        onClick: vi.fn()
      }
    ])
    await openMenu(menuRef)

    await user.click(screen.getByRole('button', { name: 'Disabled action' }))

    expect(onAction).not.toHaveBeenCalled()

    unmount()
  })

  it('hides on pointerdown outside the popover', async () => {
    const { menuRef, unmount } = renderMenu(createEntries())

    const trigger = document.createElement('button')
    const outside = document.createElement('div')
    document.body.append(trigger, outside)

    await menuRef.value!.open(createTriggerEvent('contextmenu', trigger))
    await nextTick()
    expect(screen.getByTestId('popover')).toBeInTheDocument()

    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.pointerDown(outside)
    await nextTick()

    expect(screen.queryByTestId('popover')).not.toBeInTheDocument()

    unmount()
  })

  it('keeps the menu open through trigger pointerdown and closes on same trigger click', async () => {
    const { menuRef, unmount } = renderMenu(createEntries())

    const trigger = document.createElement('button')
    document.body.append(trigger)

    await menuRef.value!.open(createTriggerEvent('click', trigger))
    await nextTick()
    expect(screen.getByTestId('popover')).toBeInTheDocument()

    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.pointerDown(trigger)
    await nextTick()
    expect(screen.getByTestId('popover')).toBeInTheDocument()

    await menuRef.value!.open(createTriggerEvent('click', trigger))
    await nextTick()
    expect(screen.queryByTestId('popover')).not.toBeInTheDocument()

    unmount()
  })
})
