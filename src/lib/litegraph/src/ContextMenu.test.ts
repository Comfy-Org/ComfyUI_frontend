import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ContextMenu } from '@/lib/litegraph/src/ContextMenu'

describe('ContextMenu lifecycle events', () => {
  let listener: (event: Event) => void
  let calls: Event[]

  beforeEach(() => {
    document.body.innerHTML = ''
    calls = []
    listener = (event) => calls.push(event)
    document.addEventListener('litegraph:contextmenu', listener)
  })

  afterEach(() => {
    document.removeEventListener('litegraph:contextmenu', listener)
  })

  it('dispatches an "open" event when a top-level menu is constructed', () => {
    new ContextMenu(['Item A', 'Item B'], {})

    expect(calls).toHaveLength(1)
    const detail = (calls[0] as CustomEvent).detail
    expect(detail.type).toBe('open')
  })

  it('dispatches a "close" event when a top-level menu closes', () => {
    const menu = new ContextMenu(['Item A'], {})
    calls.length = 0

    menu.close()

    expect(calls).toHaveLength(1)
    const detail = (calls[0] as CustomEvent).detail
    expect(detail.type).toBe('close')
    expect(detail.menu).toBe(menu)
  })

  it('does not dispatch lifecycle events for submenus', () => {
    const parent = new ContextMenu(['Item A'], {})
    calls.length = 0

    new ContextMenu(['Sub Item'], { parentMenu: parent })

    expect(calls).toHaveLength(0)
  })
})
