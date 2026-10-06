import { describe, expect, it } from 'vitest'

import {
  auditMediaLabels,
  auditModelDefinition,
  auditModelPage
} from './models-html-audit'

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

describe(auditModelDefinition, () => {
  const definition = (text: string) =>
    `<p class="text-sm" data-testid="model-definition">\n  ${text}\n</p>`
  const facts = (rows: string) =>
    `<dl class="grid" data-testid="model-facts"><!--[-->${rows}<!--]--></dl>`
  const routerRow =
    '<dt class="a">Router model ID</dt><dd class="b">bfl/flux-2-max</dd>'

  it.for([
    {
      name: 'the sentence and the Router id row',
      html:
        definition(
          'FLUX 2 Max is a model. You can call it through the Comfy Router API as bfl/flux-2-max.'
        ) + facts(`<dt>Provider</dt><dd>BFL</dd>${routerRow}`),
      errors: []
    },
    {
      name: 'an empty sentence and no facts',
      html: definition('') + facts(''),
      errors: [
        'expected a definition containing " as bfl/flux-2-max."',
        'expected a "Router model ID" row reading bfl/flux-2-max'
      ]
    },
    {
      name: 'the sentence only inside a template',
      html: `<template>${definition('… as bfl/flux-2-max.')}${facts(routerRow)}</template>`,
      errors: [
        'expected a definition containing " as bfl/flux-2-max."',
        'expected a "Router model ID" row reading bfl/flux-2-max'
      ]
    },
    {
      name: "another model's Router id",
      html:
        definition('X is a model. … as bfl/flux-2-pro.') +
        facts(
          '<dt>Router model ID</dt><dd class="font-mono">bfl/flux-2-pro</dd>'
        ),
      errors: [
        'expected a definition containing " as bfl/flux-2-max."',
        'expected a "Router model ID" row reading bfl/flux-2-max'
      ]
    }
  ])('$name', ({ html, errors }) => {
    expect(auditModelDefinition(html, 'bfl/flux-2-max')).toEqual(errors)
  })
})

describe(auditMediaLabels, () => {
  it.for([
    {
      name: 'named images and videos',
      html: '<img src="a.webp" alt="FLUX: Fox"><img src="b.webp" alt><video src="c.mp4" aria-label="Seedance: Neon"></video><video src="d.mp4" muted></video>',
      errors: []
    },
    {
      name: 'placeholder and missing alts',
      html: '<img src="a.webp" alt="Sample 1"><img src="b.webp" alt="Output"><img data-alt="Logo" src="c.webp">',
      errors: [
        'has an image with alt "Sample 1": a.webp',
        'has an image with alt "Output": b.webp',
        'has an image without alt: c.webp'
      ]
    },
    {
      name: 'placeholder video labels',
      html: '<video src="a.mp4" aria-label="Output"></video><video aria-label="Sample 2" src="b.mp4"></video>',
      errors: [
        'has a video labelled "Output": a.mp4',
        'has a video labelled "Sample 2": b.mp4'
      ]
    },
    {
      name: 'placeholders only in a template',
      html: '<template><video src="a.mp4" aria-label="Output"></video><img src="b.webp"></template>',
      errors: []
    }
  ])('$name', ({ html, errors }) => {
    expect(auditMediaLabels(html)).toEqual(errors)
  })
})
