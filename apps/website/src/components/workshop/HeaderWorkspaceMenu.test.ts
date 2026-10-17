import {
  queryHelpers,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import type { WorkshopSession } from '../../config/workshop-session-state'
import type { WorkspaceWithRole } from '../../lib/workshop/workspaces'
import HeaderWorkspaceMenu from './HeaderWorkspaceMenu.vue'

const GAP = 12
const PANEL_LEFT = 100
const PANEL_WIDTH = 300
const NARROWER_PANEL_LEFT = 180
const TRIGGER_LEFT = 360

class FakeResizeObserver {
  static observed: { target: Element; report: () => void }[] = []

  constructor(private readonly report: () => void) {}

  observe(target: Element) {
    FakeResizeObserver.observed.push({ target, report: this.report })
  }

  unobserve(target: Element) {
    FakeResizeObserver.observed = FakeResizeObserver.observed.filter(
      (entry) => entry.target !== target || entry.report !== this.report
    )
  }

  disconnect() {
    FakeResizeObserver.observed = FakeResizeObserver.observed.filter(
      (entry) => entry.report !== this.report
    )
  }
}

const workspace = { id: 'ws', name: 'Personal', type: 'personal' as const }

const session: WorkshopSession = {
  uid: 'u',
  token: 'token',
  expiresAt: Date.now() + 60_000,
  workspace,
  role: 'owner',
  permissions: []
}

const workspaces: readonly WorkspaceWithRole[] = [
  {
    ...workspace,
    role: 'owner',
    created_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z'
  }
]

function renderMenu() {
  FakeResizeObserver.observed = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  const open = ref(false)
  render(
    defineComponent({
      setup: () => () =>
        h(DropdownMenuRoot, { open: true }, () => [
          h(DropdownMenuTrigger, null, () => 'Account'),
          h(DropdownMenuPortal, null, () =>
            h(
              DropdownMenuContent,
              { 'data-testid': 'header-account-menu' },
              () =>
                h(HeaderWorkspaceMenu, {
                  open: open.value,
                  'onUpdate:open': (isOpen: boolean) => (open.value = isOpen),
                  session,
                  workspaces
                })
            )
          )
        ])
    })
  )
  return open
}

/**
 * A DOM without layout puts every edge at zero, which would leave the menu,
 * the button inside it and the submenu beside it on top of one another.
 */
async function placeAt(testId: string, left: number, width: number) {
  const element = await screen.findByTestId(testId)
  const rect = {
    x: left,
    y: 0,
    left,
    right: left + width,
    top: 0,
    bottom: 40,
    width,
    height: 40
  }
  element.getBoundingClientRect = () => rect as DOMRect
  return {
    watchers: () =>
      FakeResizeObserver.observed.filter((entry) => entry.target === element)
        .length,
    // The menu hangs off the avatar, so narrowing it moves its left edge and
    // leaves its right one where it was.
    narrowTo: (narrower: number) => {
      const left = rect.right - narrower
      Object.assign(rect, { x: left, left, width: narrower })
      for (const entry of FakeResizeObserver.observed)
        if (entry.target === element) entry.report()
    }
  }
}

/** Where the submenu ends up: floating-ui writes it onto the wrapper. */
function submenuEdge() {
  const positioned = queryHelpers
    .queryAllByAttribute('data-reka-popper-content-wrapper', document.body, '')
    .find((wrapper) => within(wrapper).queryByTestId('account-workspaces'))
  return Number(
    /translate\((-?[\d.]+)px/.exec(positioned?.getAttribute('style') ?? '')?.[1]
  )
}

describe('HeaderWorkspaceMenu', () => {
  it('opens clear of the menu the switcher sits in', async () => {
    const open = renderMenu()
    await placeAt('header-account-menu', PANEL_LEFT, PANEL_WIDTH)
    await placeAt('account-workspace', TRIGGER_LEFT, 32)

    open.value = true
    await nextTick()

    await waitFor(() => expect(submenuEdge()).toBe(PANEL_LEFT - GAP))
  })

  it('follows the menu edge when the menu is resized under it', async () => {
    const open = renderMenu()
    const panel = await placeAt('header-account-menu', PANEL_LEFT, PANEL_WIDTH)
    await placeAt('account-workspace', TRIGGER_LEFT, 32)

    open.value = true
    await nextTick()
    await waitFor(() => expect(submenuEdge()).toBe(PANEL_LEFT - GAP))

    panel.narrowTo(PANEL_WIDTH - (NARROWER_PANEL_LEFT - PANEL_LEFT))

    await waitFor(() => expect(submenuEdge()).toBe(NARROWER_PANEL_LEFT - GAP))
  })

  it('watches the menu only while the submenu is open', async () => {
    const open = renderMenu()
    const panel = await placeAt('header-account-menu', PANEL_LEFT, PANEL_WIDTH)
    await placeAt('account-workspace', TRIGGER_LEFT, 32)

    // The menu is its own floating element, so it arrives already watched.
    const others = panel.watchers()

    open.value = true
    await nextTick()
    expect(panel.watchers()).toBe(others + 1)

    open.value = false
    await nextTick()
    expect(panel.watchers()).toBe(others)
  })
})
