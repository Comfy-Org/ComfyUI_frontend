import DOMPurify from 'dompurify'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ContextMenu } from '@/lib/litegraph/src/ContextMenu'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

describe('ContextMenu sanitisation', () => {
  const styledContent = '<span style="color: red; position: fixed">Label</span>'
  let menu: ContextMenu | undefined

  afterEach(() => {
    menu?.close()
    menu = undefined
  })

  it('filters menu styles without changing the default DOMPurify instance', () => {
    menu = new LiteGraph.ContextMenu([{ content: styledContent }], {
      event: new MouseEvent('contextmenu')
    })

    expect(menu.root.querySelector('span')?.getAttribute('style')).toBe(
      'color: red'
    )
    expect(DOMPurify.sanitize(styledContent, { ALLOWED_ATTR: ['style'] })).toBe(
      styledContent
    )
  })
})

describe('ContextMenu separators', () => {
  let menu: ContextMenu | undefined

  afterEach(() => {
    menu?.close()
    menu = undefined
  })

  it('ignores clicks on a separator', () => {
    const callback = vi.fn()
    menu = new LiteGraph.ContextMenu(['First', null, 'Second'], {
      event: new MouseEvent('contextmenu'),
      callback
    })
    const separator = menu.root.querySelector<HTMLElement>(
      '.litemenu-entry.separator'
    )!

    expect(() =>
      separator.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    ).not.toThrow()
    expect(callback).not.toHaveBeenCalled()
    expect(menu.root.isConnected).toBe(true)
  })
})
