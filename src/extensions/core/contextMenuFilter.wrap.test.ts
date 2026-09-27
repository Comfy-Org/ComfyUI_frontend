import { describe, expect, it, vi } from 'vitest'

import { ContextMenu, LiteGraph } from '@/lib/litegraph/src/litegraph'
vi.mock(import('@/scripts/app'))

const { app } = await import('@/scripts/app')
await import('./contextMenuFilter')
const ext = vi.mocked(app.registerExtension).mock.calls[0][0]

describe('Comfy.ContextMenuFilter', () => {
  it('keeps LiteGraph.ContextMenu callable without new for wrapping extensions', () => {
    void ext.init?.(app)

    const orig = LiteGraph.ContextMenu
    const menu = Reflect.apply(orig, {}, [['a', 'b'], { title: 'wrapped' }])

    expect(menu).toBeInstanceOf(ContextMenu)
    expect(menu.options.title).toBe('wrapped')
  })
})
