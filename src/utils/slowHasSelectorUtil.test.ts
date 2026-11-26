import { describe, expect, it, onTestFinished } from 'vitest'

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
    'body:not(.compact):has(.dialog)',
    'html[data-theme="dark"]:not(.compact):has(.dialog) .toolbar',
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
    'body:not(.compact) .card:has(.badge)',
    'body:is(.a, .b):has(> .dialog)',
    '.body:has(.badge)',
    'tbody:has(.row)',
    'body .card',
    ':root'
  ])('allows %s', (selector) => {
    expect(isSlowHasSelector(selector)).toBe(false)
  })
})

describe('warnAboutSlowHasSelectors', () => {
  function sheetAt(href: string, css: string) {
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    onTestFinished(() => style.remove())
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

    warnAboutSlowHasSelectors([
      blocked,
      sheetAt('/after.css', 'body:has(.dragging) { color: red }')
    ])

    expect(console.warn).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('/after.css: body:has(.dragging)')
    )
  })

  it('scans imported stylesheets and names them', () => {
    const theme = sheetAt('/theme.css', 'body:has(.dialog) { color: red }')
    const parent = {
      href: '/style.css',
      cssRules: [{ styleSheet: theme }] as unknown as CSSRuleList
    } as CSSStyleSheet

    warnAboutSlowHasSelectors([parent])

    expect(console.warn).toHaveBeenCalledOnce()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('/theme.css: body:has(.dialog)')
    )
  })

  it('leaves the query string out of the stylesheet name', () => {
    warnAboutSlowHasSelectors([
      sheetAt(
        'https://cdn.example/style.css?token=secret#x',
        'body:has(.dialog) { color: red }'
      )
    ])

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://cdn.example/style.css: body:has(.dialog)'
      )
    )
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('secret')
    )
  })
})
