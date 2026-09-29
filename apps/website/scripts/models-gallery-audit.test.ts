import { describe, expect, it } from 'vitest'

import { auditExampleGallery } from './models-gallery-audit'

const gallery = (figures: string) =>
  `<section data-testid="examples-section"><ul>${figures}</ul></section>`
const figure = (alt: string, caption?: string) =>
  `<li data-testid="example-item"><figure><button><img src="x.webp" alt="${alt}"></button>${
    caption === undefined ? '' : `<figcaption>\n  ${caption}\n</figcaption>`
  }</figure></li>`
const prompt = 'a red fox & a "blue" moon'

describe(auditExampleGallery, () => {
  it.for([
    {
      name: 'each prompt captioned once, alts named',
      html: gallery(
        figure('FLUX: Fox', 'a red fox &amp; a &quot;blue&quot; moon') +
          figure('FLUX example output 2')
      ),
      examples: [{ prompt }, {}],
      errors: []
    },
    {
      name: 'no examples and no gallery',
      html: '<main><h1>FLUX</h1></main>',
      examples: [],
      errors: []
    },
    {
      name: 'a gallery with no examples',
      html: gallery(''),
      examples: [],
      errors: ['renders a gallery with no examples']
    },
    {
      name: 'examples without a gallery',
      html: '<main><h1>FLUX</h1></main>',
      examples: [{}],
      errors: ['renders 0 example cards, expected 1']
    },
    {
      name: 'a prompt only in the island props',
      html: `<astro-island props="{&quot;prompt&quot;:&quot;fox&quot;}">${gallery(figure('A: B'))}</astro-island>`,
      examples: [{ prompt: 'fox' }],
      errors: ['captions "fox" 0 times, expected 1']
    },
    {
      name: 'a prompt captioned twice for one example',
      html: gallery(figure('A: B', 'fox') + figure('A: C', 'fox')),
      examples: [{ prompt: 'fox' }],
      errors: [
        'renders 2 example cards, expected 1',
        'captions "fox" 2 times, expected 1'
      ]
    },
    {
      name: 'two examples sharing a prompt',
      html: gallery(figure('A: B', 'fox') + figure('A: C', 'fox')),
      examples: [{ prompt: 'fox' }, { prompt: 'fox' }],
      errors: []
    },
    {
      name: 'a prompt only in a template',
      html: `<template>${gallery(figure('A: B', 'fox'))}</template>`,
      examples: [{ prompt: 'fox' }],
      errors: [
        'renders 0 example cards, expected 1',
        'captions "fox" 0 times, expected 1'
      ]
    }
  ])('$name', ({ html, examples, errors }) => {
    expect(auditExampleGallery(html, examples)).toEqual(errors)
  })
})
