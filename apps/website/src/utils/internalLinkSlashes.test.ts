import { describe, expect, it } from 'vitest'

import {
  aliasHostHrefs,
  isSlashlessPageHref,
  slashlessPageHrefs
} from './internalLinkSlashes'

const ORIGIN = 'https://comfy.org'
const ORIGINS = [ORIGIN]
const ALIAS_ORIGINS = ['https://www.comfy.org']

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
    expect(isSlashlessPageHref(href, ORIGINS)).toBe(expected)
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
      <a href="/authors/o'reilly/">Author</a>
      <a data-href="/ignored">Not a link</a>
      <link rel="alternate" type="text/markdown" href="/pricing.md">`

    expect(slashlessPageHrefs(html, ORIGINS)).toEqual([
      '/pricing',
      '/models?type=apps&q=wan'
    ])
  })
})

describe('aliasHostHrefs', () => {
  it('reports links through the www host, slashed or not', () => {
    const html = `
      <a href="https://www.comfy.org/cloud/">Cloud</a>
      <a href="https://www.comfy.org">Home</a>
      <a href="https://www.comfy.org?ref=x">Home with query</a>
      <a href="https://comfy.org/cloud/">Apex</a>
      <a href="https://www.comfy.org.evil.com/">Lookalike</a>
      <a href="https://docs.comfy.org/">Docs</a>`

    expect(aliasHostHrefs(html, ALIAS_ORIGINS)).toEqual([
      'https://www.comfy.org/cloud/',
      'https://www.comfy.org',
      'https://www.comfy.org?ref=x'
    ])
  })
})
