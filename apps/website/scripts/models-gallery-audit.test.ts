import { describe, expect, it } from 'vitest'

import { auditExampleGallery } from './models-gallery-audit'

const gallery = (figures: string) =>
  `<section data-testid="examples-section"><ul>${figures}</ul></section>`
const figure = (alt: string) =>
  `<li data-testid="example-item"><figure><button><img src="x.webp" alt="${alt}"></button></figure></li>`

describe(auditExampleGallery, () => {
  it.for([
    {
      name: 'a card on the server for every example',
      html: gallery(figure('FLUX: Fox') + figure('FLUX example output 2')),
      exampleCount: 2,
      errors: []
    },
    {
      name: 'no examples and no gallery',
      html: '<main><h1>FLUX</h1></main>',
      exampleCount: 0,
      errors: []
    },
    {
      name: 'a gallery with no examples',
      html: gallery(''),
      exampleCount: 0,
      errors: ['renders a gallery with no examples']
    },
    {
      name: 'examples without a gallery',
      html: '<main><h1>FLUX</h1></main>',
      exampleCount: 1,
      errors: ['renders 0 example cards, expected 1']
    },
    {
      name: 'a card only in a template',
      html: `<template>${gallery(figure('A: B'))}</template>`,
      exampleCount: 1,
      errors: ['renders 0 example cards, expected 1']
    },
    {
      name: 'more cards than examples',
      html: gallery(figure('A: B') + figure('A: C')),
      exampleCount: 1,
      errors: ['renders 2 example cards, expected 1']
    }
  ])('$name', ({ html, exampleCount, errors }) => {
    expect(auditExampleGallery(html, exampleCount)).toEqual(errors)
  })
})
