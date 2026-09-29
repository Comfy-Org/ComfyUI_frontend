import { describe, expect, it } from 'vitest'

import { isSlashlessPageHref, slashlessPageHrefs } from './internalLinkSlashes'

const ORIGIN = 'https://comfy.org'

describe('isSlashlessPageHref', () => {
  it.for([
    ['/pricing', true],
    ['/zh-CN/cloud', true],
    ['/cloud/pricing#faq', true],
    ['/models?type=apps', true],
    ['/seedance-2.5', true],
    ['/wan-3.0', true],
    [`${ORIGIN}/pricing`, true],
    ['/', false],
    ['/pricing/', false],
    ['/cloud/pricing/#faq', false],
    ['/models/?type=apps', false],
    ['/llms.txt', false],
    ['/models.md', false],
    ['/sitemap-index.xml', false],
    ['/_astro/app.CzX1.css', false],
    ['#main', false],
    ['?page=2', false],
    ['//cdn.example.com/lib', false],
    ['https://docs.comfy.org/cli', false],
    ['mailto:hello@comfy.org', false]
  ] as const)('%s -> %s', ([href, expected]) => {
    expect(isSlashlessPageHref(href, ORIGIN)).toBe(expected)
  })
})

describe('slashlessPageHrefs', () => {
  it('reports each offending href once, from any tag or quote style', () => {
    const html = `
      <link rel="canonical" href="https://comfy.org/pricing/">
      <a href="/pricing">Pricing</a>
      <a class="x" href='/pricing'>Pricing again</a>
      <a href="/download/">Download</a>
      <a href="/models?type=apps&amp;q=wan">Apps</a>
      <link rel="alternate" type="text/markdown" href="/pricing.md">`

    expect(slashlessPageHrefs(html, ORIGIN)).toEqual([
      '/pricing',
      '/models?type=apps&q=wan'
    ])
  })
})
