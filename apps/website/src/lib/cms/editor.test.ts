import type { ContentCatalogRecord } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'

import {
  editorProblems,
  editorState,
  newFromTemplate,
  pageSlug,
  savedRecord
} from './editor'

const model: ContentCatalogRecord = {
  uid: '00000000-0000-4000-8000-000000000001',
  revision: 1,
  edit_version: 'v1',
  kind: 'MODEL',
  slug: '/hub/models/flux',
  enabled: true,
  visibility: 'PUBLIC',
  deleted: false,
  data: {
    slug: 'flux',
    href: '/hub/models/flux/',
    name: 'Flux',
    summary: 'Makes images',
    provider: 'BFL',
    capabilities: ['image', 'fast'],
    thumbnail: { url: 'https://media.comfy.org/a.png', kind: 'image' },
    thumbnailUrl: 'https://media.comfy.org/a.png',
    defaults: { steps: 20 },
    execution: {
      inputSchema: {
        required: ['prompt'],
        properties: {
          prompt: { type: 'string' },
          steps: { type: 'integer', default: 30 },
          style: { type: 'string', enum: ['photo', 'art'] }
        }
      }
    },
    examples: [
      {
        title: 'Cat',
        thumbnailUrl: 'https://media.comfy.org/cat.png',
        mediaKind: 'image',
        values: { prompt: 'a cat', seed: 1 },
        prompt: 'a cat'
      }
    ]
  }
}

describe('content editor', () => {
  it('reads the fields the form edits', () => {
    const state = editorState(model)
    expect(state).toMatchObject({
      name: 'Flux',
      credit: 'BFL',
      tags: 'image, fast',
      cover: { url: 'https://media.comfy.org/a.png', kind: 'image' }
    })
    expect(state.examples[0]).toMatchObject({ title: 'Cat', prompt: 'a cat' })
    expect(state.parameters).toEqual([
      expect.objectContaining({
        name: 'prompt',
        placement: 'basic',
        required: true
      }),
      expect.objectContaining({
        name: 'steps',
        defaultValue: '20',
        placement: 'advanced'
      }),
      expect.objectContaining({ name: 'style', options: ['photo', 'art'] })
    ])
  })

  it('writes edits back without losing what the form does not show', () => {
    const state = editorState(model)
    state.name = 'Flux 2'
    state.tags = 'image, , new'
    state.translation = { name: 'Flux 二', summary: '' }
    state.examples[0].prompt = 'a dog'
    state.parameters[1].defaultValue = '12'
    state.parameters[2].placement = 'hidden'
    state.visibleFrom = '2026-10-20T16:00'
    const saved = savedRecord(state, model.data)
    expect(saved.visible_from).toBe('2026-10-20T16:00:00.000Z')
    expect(saved.data).toMatchObject({
      name: 'Flux 2',
      capabilities: ['image', 'new'],
      translations: { 'zh-CN': { name: 'Flux 二', summary: '' } },
      defaults: { steps: 12 },
      formLayout: { prompt: 'basic', steps: 'advanced', style: 'hidden' },
      execution: model.data.execution,
      href: '/hub/models/flux/'
    })
    expect(saved.data.examples).toEqual([
      expect.objectContaining({
        prompt: 'a dog',
        values: { prompt: 'a dog', seed: 1 }
      })
    ])
  })

  it('starts a new item from a template under its own address', () => {
    const state = newFromTemplate(model, 'new-uid')
    state.name = 'Flux Turbo!'
    state.slug = pageSlug('MODEL', state.name)
    expect(state.slug).toBe('/hub/models/flux-turbo')
    expect(editorProblems(state)).toEqual([])
    expect(savedRecord(state, model.data).data).toMatchObject({
      slug: 'flux-turbo',
      href: '/hub/models/flux-turbo/'
    })
  })

  it('names what still needs filling in', () => {
    const state = newFromTemplate(model, 'new-uid')
    state.cover.url = ' '
    expect(editorProblems(state)).toEqual(['name', 'slug', 'cover'])
  })
})
