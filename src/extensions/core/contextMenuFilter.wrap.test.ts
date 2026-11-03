import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import { ContextMenu, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyApp } from '@/scripts/app'

import { contextMenuFilterExtension } from './contextMenuFilter'

describe('Comfy.ContextMenuFilter', () => {
  void contextMenuFilterExtension.init?.(fromPartial<ComfyApp>({}))
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
