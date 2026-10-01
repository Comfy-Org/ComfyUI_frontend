import { describe, expect, it, vi } from 'vitest'

import { ContextMenu, LiteGraph } from '@/lib/litegraph/src/litegraph'
vi.mock(import('@/scripts/app'))

const { app } = await import('@/scripts/app')
await import('./contextMenuFilter')
const ext = vi.mocked(app.registerExtension).mock.calls[0][0]

describe('Comfy.ContextMenuFilter', () => {
  void ext.init?.(app)
  const wrapped = LiteGraph.ContextMenu

  it.for([
    {
      via: 'call',
      make: () => Reflect.apply(wrapped, {}, [['a'], { title: 'wrapped' }])
    },
    { via: 'new', make: () => new wrapped(['a'], { title: 'wrapped' }) }
  ])('constructs a ContextMenu via $via', ({ make }) => {
    const menu = make()
    expect(menu).toBeInstanceOf(ContextMenu)
    expect(menu.options.title).toBe('wrapped')
  })

  it('keeps statics and prototype', () => {
    expect(wrapped.trigger).toBe(ContextMenu.trigger)
    expect(wrapped.prototype).toBe(ContextMenu.prototype)
  })
})
