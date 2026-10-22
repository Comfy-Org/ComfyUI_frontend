import DOMPurify from 'dompurify'
import { afterEach, describe, expect, it } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'

describe('ContextMenu sanitisation', () => {
  const styledContent = '<span style="color: red; position: fixed">Label</span>'

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('filters menu styles without changing the default DOMPurify instance', () => {
    const menu = new LiteGraph.ContextMenu([{ content: styledContent }], {
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
