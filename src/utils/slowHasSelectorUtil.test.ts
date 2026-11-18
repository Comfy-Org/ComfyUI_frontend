import { afterEach, describe, expect, it } from 'vitest'

import {
  isSlowHasSelector,
  warnAboutSlowHasSelectors
} from '@/utils/slowHasSelectorUtil'

describe('isSlowHasSelector', () => {
  it.for([
    ':root:has(.sidebar.small)',
    ':root:has(.dialog[data-state="open"]) .toolbar',
    'html.dark:has(.panel) .item',
    'body:has(.dragging) .node',
    '.a, body:has(.b)',
    ':is(body:has(.b) *)'
  ])('flags %s', (selector) => {
    expect(isSlowHasSelector(selector)).toBe(true)
  })

  it.for([
    'body:has(> [data-slot="dialog-portal"] > [data-state="open"]) .toolbar',
    ':root:has(> body.dark)',
    '.group:has(:focus-visible) .target',
    '.target:is(:where(.group):has(:focus-visible) *)',
    '.card:has(.badge)',
    '.body:has(.badge)',
    'tbody:has(.row)',
    'body .card',
    ':root'
  ])('allows %s', (selector) => {
    expect(isSlowHasSelector(selector)).toBe(false)
  })
})

describe('warnAboutSlowHasSelectors', () => {
  afterEach(() => {
    document.head.querySelectorAll('style').forEach((el) => el.remove())
  })

  function sheetAt(href: string, css: string) {
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    return { href, cssRules: style.sheet!.cssRules } as CSSStyleSheet
  }

  it('names the stylesheet and the selector of each slow rule', () => {
    warnAboutSlowHasSelectors([
      sheetAt('/core.css', '.card:has(.badge) { color: red }'),
      sheetAt(
        '/extensions/custom-node/style.css',
        'body:has(.dragging) .node { color: red } @media (min-width: 1px) { :root:has(.open) { color: red } }'
      )
    ])

    expect(console.warn).toHaveBeenCalledTimes(2)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '/extensions/custom-node/style.css: body:has(.dragging) .node'
      )
    )
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '/extensions/custom-node/style.css: :root:has(.open)'
      )
    )
  })

  it('skips stylesheets whose rules cannot be read', () => {
    const blocked = {
      get cssRules(): CSSRuleList {
        throw new DOMException('blocked', 'SecurityError')
      }
    } as CSSStyleSheet

    expect(() => warnAboutSlowHasSelectors([blocked])).not.toThrow()
    expect(console.warn).not.toHaveBeenCalled()
  })
})
