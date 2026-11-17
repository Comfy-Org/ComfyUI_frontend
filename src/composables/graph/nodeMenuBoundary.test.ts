import { assert, describe, expect, it } from 'vitest'

import type { IContextMenuValue } from '@/lib/litegraph/src/types/contextMenu'
import { closureOnly } from '@/scripts/nodeMenu'

import { projectNodeMenu, toLegacyNodeMenu } from './nodeMenuBoundary'

describe('node menu compatibility boundary', () => {
  it.for([
    { content: 'Native title', title: 'Displayed title' },
    { content: 'Native class', className: 'extension-menu' },
    { content: '<strong>Native HTML</strong>' },
    { content: 'Imperative submenu', has_submenu: true },
    {
      content: 'Submenu with context',
      submenu: { options: ['Child'], extra: { nodeId: 42 } }
    }
  ] satisfies IContextMenuValue[])(
    'keeps native presentation for $content',
    (item) => {
      const items = [item]
      expect(projectNodeMenu(items)).toEqual({ kind: 'native', items })
    }
  )

  it('requires native execution after a wrapper replaces a declared closure', () => {
    let effects = 0
    const items = toLegacyNodeMenu(
      [
        {
          label: 'Action',
          action: () => {
            effects++
          }
        }
      ],
      ''
    )
    const item = items[0]
    assert(item?.callback)
    const previous = item.callback
    item.callback = function (...args) {
      return previous.apply(this, args)
    }

    expect(projectNodeMenu(items)).toEqual({ kind: 'native', items })
    expect(effects).toBe(0)
  })

  it('keeps undeclared leaf callbacks native even without submenus', () => {
    let effects = 0
    const items = [
      {
        content: 'Native leaf',
        callback: () => {
          effects++
        }
      }
    ]

    expect(projectNodeMenu(items)).toEqual({ kind: 'native', items })
    expect(effects).toBe(0)
  })

  it('preserves duplicate labels and declared nested leaf effects', () => {
    const effects: string[] = []
    const result = projectNodeMenu([
      {
        content: 'Parent',
        submenu: {
          options: [
            {
              content: 'Same',
              callback: closureOnly(() => {
                effects.push('first')
              })
            },
            {
              content: 'Same',
              callback: closureOnly(() => {
                effects.push('second')
              })
            }
          ]
        }
      }
    ])
    assert(result.kind === 'vue')
    expect(effects).toEqual([])
    expect(result.items[0]?.items?.map((item) => item.label)).toEqual([
      'Same',
      'Same'
    ])
    const second = result.items[0]?.items?.[1]
    assert(second?.command)
    second.command({ originalEvent: new Event('select'), item: second })
    expect(effects).toEqual(['second'])
  })
})
