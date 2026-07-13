import { describe, expect, it } from 'vitest'

import { formatDeprecationConsole } from '@/platform/dev/deprecations'

describe('formatDeprecationConsole', () => {
  it('emits a bold, color-styled [DEPRECATED] tag', () => {
    const [text, tagStyle, restStyle] = formatDeprecationConsole({
      source: 'widget',
      message: 'foo is deprecated.'
    })

    expect(text).toBe('%c[DEPRECATED:widget]%c foo is deprecated.')
    expect(tagStyle).toBe('color: orange; font-weight: bold')
    expect(restStyle).toBe('color: inherit')
  })

  it('omits the source from the tag when none is given', () => {
    const [text] = formatDeprecationConsole({ message: 'foo is deprecated.' })

    expect(text).toBe('%c[DEPRECATED]%c foo is deprecated.')
  })

  it('adds labelled lines for each present field in a uniform order', () => {
    const [text] = formatDeprecationConsole({
      source: 'litegraph',
      message: 'foo is deprecated.',
      extension: 'Comfy.Clipspace',
      detail: 'getCanvasMenuOptions',
      suggestion: 'Use bar instead.',
      docsUrl: 'https://docs.example/guide'
    })

    expect(text).toBe(
      [
        '%c[DEPRECATED:litegraph]%c foo is deprecated.',
        '  extension: Comfy.Clipspace',
        '  detail: getCanvasMenuOptions',
        '  fix: Use bar instead.',
        '  docs: https://docs.example/guide'
      ].join('\n')
    )
  })

  it('omits absent fields', () => {
    const [text] = formatDeprecationConsole({
      source: 'ChangeTracker',
      message: 'checkState() is deprecated.',
      suggestion: 'Use captureCanvasState().'
    })

    expect(text).toBe(
      '%c[DEPRECATED:ChangeTracker]%c checkState() is deprecated.\n  fix: Use captureCanvasState().'
    )
  })
})
