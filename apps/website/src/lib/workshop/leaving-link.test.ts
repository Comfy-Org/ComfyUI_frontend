// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'

import { linkLeavingPage } from './leaving-link'

const here = { origin: location.origin, href: `${location.origin}/models/a/` }
const elsewhere = `${location.origin}/models/b/`

const planted: HTMLAnchorElement[] = []
afterEach(() => {
  while (planted.length) planted.pop()?.remove()
})

function clickOn(
  attributes: Record<string, string>,
  init: Record<string, unknown> = {}
): MouseEvent {
  const link = document.createElement('a')
  for (const [name, value] of Object.entries(attributes))
    link.setAttribute(name, value)
  const inner = document.createElement('span')
  link.append(inner)
  document.body.append(link)
  planted.push(link)
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries({ target: inner, ...init }))
    Object.defineProperty(event, key, { value })
  return event
}

describe('linkLeavingPage', () => {
  it('answers with the address of a plain click on an in-site link', () => {
    expect(linkLeavingPage(clickOn({ href: elsewhere }), here)).toBe(elsewhere)
  })

  it.for([
    ['a modified click', { metaKey: true }],
    ['a middle click', { button: 1 }],
    ['a click something else already answered', { defaultPrevented: true }]
  ] as const)('stays out of %s', ([, init]) => {
    expect(
      linkLeavingPage(clickOn({ href: elsewhere }, init), here)
    ).toBeUndefined()
  })

  it.for([
    ['a download', { href: elsewhere, download: '' }],
    ['a link opening elsewhere', { href: elsewhere, target: '_blank' }],
    ['a link off this origin', { href: 'https://example.com/models/b/' }],
    ['a link back to this same page', { href: here.href }],
    ['a fragment on this same page', { href: `${here.href}#pricing` }]
  ] as const)('leaves %s to the browser', ([, attributes]) => {
    expect(linkLeavingPage(clickOn(attributes), here)).toBeUndefined()
  })

  it('ignores a click that reached no link at all', () => {
    const loose = new MouseEvent('click', { bubbles: true, cancelable: true })
    Object.defineProperty(loose, 'target', { value: document.body })
    expect(linkLeavingPage(loose, here)).toBeUndefined()
    expect(linkLeavingPage(new MouseEvent('click'), here)).toBeUndefined()
  })
})
