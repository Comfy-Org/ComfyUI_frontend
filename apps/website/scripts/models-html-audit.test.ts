import { describe, expect, it } from 'vitest'

import type { RouterWorkshopModel } from '@/config/models-catalogue'

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
  const model: RouterWorkshopModel = {
    slug: 'bfl--flux-pro-fill--edit-images',
    name: 'FLUX Pro Fill',
    provider: 'Black Forest Labs',
    task: 'image-to-image',
    modality: 'image',
    workflowCount: 0,
    capabilities: [],
    routerId: 'bfl/flux-pro-fill'
  }
  const sentence =
    'FLUX Pro Fill is an image-to-image model from Black Forest Labs. You can call it through the Comfy Router API as bfl/flux-pro-fill.'
  const definition = (text: string) =>
    `<p class="text-sm" data-testid="model-definition">\n  ${text}\n</p>`
  const facts = (rows: string) =>
    `<dl class="grid" data-testid="model-facts"><!--[-->${rows}<!--]--></dl>`
  const routerRow = (routerId: string) =>
    `<dt class="a">Router model ID</dt><dd class="b">${routerId}</dd>`
  const wrongDefinition = (found: string) =>
    `expected the definition ${JSON.stringify(sentence)}, found ${JSON.stringify(found)}`
  const missingRouterRow =
    'expected a "Router model ID" row reading bfl/flux-pro-fill'

  it.for([
    {
      name: 'the sentence and the Router id row',
      html:
        definition(sentence) +
        facts(`<dt>Provider</dt><dd>BFL</dd>${routerRow(model.routerId)}`),
      errors: []
    },
    {
      name: 'only the Router clause',
      html:
        definition(
          'You can call it through the Comfy Router API as bfl/flux-pro-fill.'
        ) + facts(routerRow(model.routerId)),
      errors: [
        wrongDefinition(
          'You can call it through the Comfy Router API as bfl/flux-pro-fill.'
        )
      ]
    },
    {
      name: 'a tampered first sentence',
      html:
        definition(sentence.replace('an image', 'a image')) +
        facts(routerRow(model.routerId)),
      errors: [wrongDefinition(sentence.replace('an image', 'a image'))]
    },
    {
      name: 'an empty sentence and no facts',
      html: definition('') + facts(''),
      errors: [wrongDefinition(''), missingRouterRow]
    },
    {
      name: 'the sentence only inside a template',
      html: `<template>${definition(sentence)}${facts(routerRow(model.routerId))}</template>`,
      errors: [wrongDefinition(''), missingRouterRow]
    },
    {
      name: "another model's Router id",
      html:
        definition(sentence.replace('bfl/flux-pro-fill', 'bfl/flux-2-pro')) +
        facts(routerRow('bfl/flux-2-pro')),
      errors: [
        wrongDefinition(
          sentence.replace('bfl/flux-pro-fill', 'bfl/flux-2-pro')
        ),
        missingRouterRow
      ]
    }
  ])('$name', ({ html, errors }) => {
    expect(auditModelDefinition(html, model)).toEqual(errors)
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
