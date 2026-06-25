import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import JobContextMenu from '@/components/queue/job/JobContextMenu.vue'
import type { MenuEntry } from '@/composables/queue/useJobMenu'

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
    target: currentTarget,
    clientX: 0,
    clientY: 0
  }) as unknown as Event

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
    props: { onAction: actionSpy }
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
  it('renders enabled and disabled entries with correct state', async () => {
    const { menuRef, unmount } = renderMenu(createEntries())
    await openMenu(menuRef)

    const enabledItem = await screen.findByRole('menuitem', {
      name: 'Enabled action'
    })
    const disabledItem = await screen.findByRole('menuitem', {
      name: 'Disabled action'
    })
    expect(enabledItem).not.toHaveAttribute('data-disabled')
    expect(disabledItem).toHaveAttribute('data-disabled')

    unmount()
  })

  it('emits action for enabled entries', async () => {
    const entries = createEntries()
    const { user, menuRef, onAction, unmount } = renderMenu(entries)
    await openMenu(menuRef)

    await user.click(
      await screen.findByRole('menuitem', { name: 'Enabled action' })
    )

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

    await user.click(
      await screen.findByRole('menuitem', { name: 'Disabled action' })
    )

    expect(onAction).not.toHaveBeenCalled()

    unmount()
  })
})
