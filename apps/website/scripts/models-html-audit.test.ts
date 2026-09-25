import { describe, expect, it } from 'vitest'

import { auditModelPage } from './models-html-audit'

const showcase = '<h1>Grok Imagine in <span>ComfyUI</span></h1>'
const related = (cards: string) =>
  `<section data-testid="related-models"><h2>More models</h2>${cards}</section>`
const modelPage = (h1: string, extra = '') =>
  `<main><h1 class="text-3xl">\n  ${h1}\n</h1><p>Summary</p>${extra}</main>`

describe(auditModelPage, () => {
  it.for([
    {
      name: 'the model rendered in the HTML',
      html: modelPage(
        'FLUX 2 Max',
        related('<a href="/models/xai--grok/">Grok Imagine Image</a>')
      ),
      errors: []
    },
    {
      name: 'the loading frame with the showcase as fallback',
      html: `<div data-testid="workshop-loading">Loading</div><template data-astro-template="fallback">${showcase}</template><noscript>${showcase}</noscript>`,
      errors: [
        'expected one h1 "FLUX 2 Max", found []',
        'contains the Grok Imagine showcase',
        'paints a loader in place of the model'
      ]
    },
    {
      name: 'a second h1',
      html: modelPage('FLUX 2 Max') + '<h1>Other</h1>',
      errors: ['expected one h1 "FLUX 2 Max", found ["FLUX 2 Max","Other"]']
    },
    {
      name: 'Grok named above the related models',
      html: modelPage('FLUX 2 Max', '<p>Try Grok Imagine</p>'),
      errors: ['names Grok Imagine outside the related models']
    }
  ])('$name', ({ html, errors }) => {
    expect(auditModelPage(html, 'FLUX 2 Max')).toEqual(errors)
  })

  it('lets a Grok page name itself', () => {
    expect(
      auditModelPage(
        modelPage('Grok Imagine &amp; Video'),
        'Grok Imagine & Video'
      )
    ).toEqual([])
  })
})
