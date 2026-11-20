import { reportError } from '@comfyorg/telemetry/reportError'
import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'

function uiApi() {
  return createComfyApi({ getGraph: () => null }).comfy.ui
}

function click() {
  return new MouseEvent('click', { clientX: 40, clientY: 50 })
}

afterEach(async () => {
  await userEvent.click(document.body)
})

describe('menus', () => {
  it('shows the items at the pointer and runs the one chosen', async () => {
    const remove = vi.fn()
    uiApi().showMenu({
      title: 'Lora',
      event: click(),
      items: [
        { label: 'Move up', run: vi.fn() },
        { label: 'Remove', run: remove }
      ]
    })

    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove' }))

    expect(remove).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('shows a label as text, not markup', () => {
    uiApi().showMenu({
      event: click(),
      items: [{ label: '<b>bold</b>', run: vi.fn() }]
    })

    expect(screen.getByRole('menuitem').textContent).toBe('<b>bold</b>')
  })

  it('shows a disabled item that cannot be chosen', async () => {
    const run = vi.fn()
    uiApi().showMenu({
      event: click(),
      items: [{ label: 'No bookmarks', disabled: true, run }]
    })

    const item = screen.getByRole('menuitem', { name: 'No bookmarks' })
    await userEvent.click(item)

    expect(item.getAttribute('aria-disabled')).toBe('true')
    expect(run).not.toHaveBeenCalled()
  })

  it('opens a submenu and runs an item in it', async () => {
    const pick = vi.fn()
    uiApi().showMenu({
      event: click(),
      items: [{ label: 'Type', submenu: [{ label: 'IMAGE', run: pick }] }]
    })

    await userEvent.click(screen.getByRole('menuitem', { name: 'Type' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'IMAGE' }))

    expect(pick).toHaveBeenCalledOnce()
  })

  it('reports an item that throws, and still closes the menu', async () => {
    const broken = new Error('pack item failed')
    uiApi().showMenu({
      event: click(),
      items: [
        {
          label: 'Break',
          run: () => {
            throw broken
          }
        }
      ]
    })

    await userEvent.click(screen.getByRole('menuitem', { name: 'Break' }))

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ tags: { event: 'ui.showMenu' } })
    )
    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it.for([
    { name: 'no menu', menu: [], needs: 'a menu as a plain object' },
    {
      name: 'a field a menu does not have',
      menu: { event: click(), items: [{ label: 'a' }], x: 4 },
      needs: 'a menu of items, title, event only'
    },
    {
      name: 'no items',
      menu: { event: click(), items: [] },
      needs: 'items with at least one item'
    },
    {
      name: 'no event',
      menu: { items: [{ label: 'a' }] },
      needs: 'event as the MouseEvent that asked for it'
    },
    {
      name: 'a keyboard event',
      menu: { event: new KeyboardEvent('keydown'), items: [{ label: 'a' }] },
      needs: 'event as the MouseEvent that asked for it'
    },
    {
      name: 'an item that is not an object',
      menu: { event: click(), items: ['a'] },
      needs: 'items[0] as a plain object'
    },
    {
      name: 'a field a menu item does not have',
      menu: { event: click(), items: [{ label: 'a', onClick: () => {} }] },
      needs: 'items[0] of label, disabled, submenu, run only'
    },
    {
      name: 'an item without a label',
      menu: { event: click(), items: [{ run: () => {} }] },
      needs: 'items[0].label as a string'
    },
    {
      name: 'a disabled flag that is not a boolean',
      menu: { event: click(), items: [{ label: 'a', disabled: 'yes' }] },
      needs: 'items[0].disabled as a boolean'
    },
    {
      name: 'a run that is not a function',
      menu: { event: click(), items: [{ label: 'a', run: 'go' }] },
      needs: 'items[0].run as a function'
    },
    {
      name: 'an item with a submenu and a run',
      menu: {
        event: click(),
        items: [{ label: 'a', run: () => {}, submenu: [{ label: 'b' }] }]
      },
      needs: 'items[0] with a submenu or run, not both'
    },
    {
      name: 'a bad item deep in a submenu',
      menu: {
        event: click(),
        items: [{ label: 'a', submenu: [{ label: 'b', submenu: [] }] }]
      },
      needs: 'items[0].submenu[0].submenu with at least one item'
    },
    {
      name: 'a title that is not text',
      menu: { event: click(), items: [{ label: 'a' }], title: 1 },
      needs: 'title as a string'
    }
  ])('refuses $name, and shows nothing', ({ menu, needs }) => {
    const ui = uiApi()

    expect(() => Reflect.apply(ui.showMenu, ui, [menu])).toThrow(
      expect.objectContaining({
        name: 'TypeError',
        message: expect.stringContaining(`ui.showMenu needs ${needs}, not `)
      })
    )
    expect(screen.queryByRole('menuitem')).toBeNull()
  })
})
