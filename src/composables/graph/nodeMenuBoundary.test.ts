import { assert, describe, expect, it, vi } from 'vitest'

import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'

import { projectNodeMenu, toLegacyNodeMenu } from './nodeMenuBoundary'

vi.mock(import('@comfyorg/telemetry/reportError'))

function choose(
  item: MenuItem | undefined,
  originalEvent = new Event('select', { cancelable: true })
) {
  assert(item?.command)
  item.command({ originalEvent, item })
  return originalEvent
}

describe('node menu compatibility boundary', () => {
  it('does not turn curated action results into keep-open signals', () => {
    let opened = false
    const items = toLegacyNodeMenu(
      [{ label: 'Open panel', action: () => (opened = true) }],
      ''
    )
    const event = choose(projectNodeMenu(items, undefined)[0])
    expect(opened).toBe(true)
    expect(event.defaultPrevented).toBe(false)
  })

  it('keeps an extension-disabled shape unavailable after projection', () => {
    const items = toLegacyNodeMenu(
      [
        {
          label: 'Shape',
          isShapePicker: true,
          submenu: [{ label: 'Round', action() {} }]
        }
      ],
      'Round'
    )
    const child = items[0]?.submenu?.options[0]
    assert(child && typeof child !== 'string')
    child.disabled = true
    const [shape] = projectNodeMenu(items, undefined)
    expect(shape.radioGroup).toBeUndefined()
    expect(shape.items).toMatchObject([{ label: 'Round', disabled: true }])
  })

  it('passes the legacy callback contract only when the item is chosen', () => {
    const node = new LGraphNode('Target')
    const calls: unknown[][] = []
    const item: IContextMenuValue = {
      content: 'Legacy',
      callback(...args) {
        calls.push([this.value, ...args])
      }
    }
    const [projected] = projectNodeMenu([item], node)
    expect(calls).toEqual([])

    choose(projected)

    expect(calls).toHaveLength(1)
    const [receiverValue, value, , event, , extra] = calls[0]
    expect(receiverValue).toBe(item)
    expect(value).toBe(item)
    expect(event).toBeInstanceOf(MouseEvent)
    expect(extra).toBe(node)
  })

  it('keeps the menu open when a legacy callback returns true', () => {
    const [projected] = projectNodeMenu(
      [{ content: 'Stay open', callback: () => true }],
      undefined
    )
    expect(choose(projected).defaultPrevented).toBe(true)
  })

  it('runs a submenu callback with its own context for each child', () => {
    const seen: unknown[] = []
    const [parent] = projectNodeMenu(
      [
        {
          content: 'Layout',
          submenu: {
            options: ['Left', 'Right'],
            extra: { nodeId: 42 },
            callback: (value) => {
              seen.push(value)
            }
          }
        }
      ],
      undefined
    )
    choose(parent.items?.[1])
    expect(seen).toEqual(['Right'])
  })

  it.for([
    {
      item: { content: 'Plain', title: 'Displayed title' },
      label: 'Displayed title'
    },
    { item: { content: '<strong>Bold</strong> text' }, label: 'Bold text' }
  ] satisfies { item: IContextMenuValue; label: string }[])(
    'labels $item.content as $label',
    ({ item, label }) => {
      expect(projectNodeMenu([item], undefined)[0]?.label).toBe(label)
    }
  )

  it('reports a throwing extension callback once and lets the menu close', () => {
    const error = new Error('extension failed')
    const [projected] = projectNodeMenu(
      [
        {
          content: 'Broken',
          callback: () => {
            throw error
          }
        }
      ],
      undefined
    )
    expect(choose(projected).defaultPrevented).toBe(false)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
      surface: 'graph',
      errorType: 'error_running_node_menu_callback'
    })
  })

  it('preserves duplicate labels and runs only the chosen nested leaf', () => {
    const effects: string[] = []
    const [parent] = projectNodeMenu(
      [
        {
          content: 'Parent',
          submenu: {
            options: [
              { content: 'Same', callback: () => void effects.push('first') },
              { content: 'Same', callback: () => void effects.push('second') }
            ]
          }
        }
      ],
      undefined
    )
    expect(parent.items?.map((item) => item.label)).toEqual(['Same', 'Same'])
    choose(parent.items?.[1])
    expect(effects).toEqual(['second'])
  })
})
