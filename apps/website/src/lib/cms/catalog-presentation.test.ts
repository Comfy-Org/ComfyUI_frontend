import type { ContentCatalogRecord } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'
import {
  catalogLanguageFallback,
  catalogPresentation
} from './catalog-presentation'

const record: ContentCatalogRecord = {
  uid: '00000000-0000-4000-8000-000000000031',
  edit_version: '00000000-0000-4000-8000-000000000032',
  kind: 'WORKFLOW',
  slug: '/hub/workflows/local-fixture',
  enabled: true,
  visibility: 'STAFF',
  deleted: false,
  revision: 2,
  data: {
    type: 'workflow',
    title: 'Source title',
    description: 'Source description',
    slug: 'local-fixture',
    source_locale: 'en',
    inputSchema: {
      type: 'object',
      properties: { quality: { type: 'number', enum: [1, 2], default: 1 } }
    },
    inputs: { quality: { label: 'Quality', control: 'dropdown' } },
    examples: [
      { name: 'example', title: 'Authored example', values: { quality: 2 } }
    ],
    translations: { 'zh-CN': { title: '本地标题', review_state: 'machine' } },
    website_media: { '$.hero': '/preview-media/2/logical-use/exact-bytes' }
  }
}
describe('native CONTENT presentation', () => {
  it('derives presentation without changing authored JSON, typed values or identity', () => {
    const before = JSON.stringify(record)
    const view = catalogPresentation(record, 'zh-CN', true)
    expect(view).toMatchObject({
      name: '本地标题',
      summary: 'Source description',
      href: record.slug + '/',
      slug: 'workflows/local-fixture',
      thumbnailUrl: '/preview-media/2/logical-use/exact-bytes',
      examples: [{ values: { quality: 2 } }],
      workflow: {
        definitionVersion: record.edit_version,
        inputSchema: { properties: { quality: { enum: [1, 2], default: 1 } } }
      }
    })
    expect(JSON.stringify(record)).toBe(before)
  })
  it('labels only missing localized primary fields in Draft', () => {
    expect(catalogLanguageFallback(record, 'zh-CN', true)).toEqual({
      source: 'en',
      fields: ['$.description']
    })
    expect(catalogLanguageFallback(record, 'en', true)).toBeUndefined()
  })
  it('does not silently use machine translations in public presentation', () => {
    expect(catalogPresentation(record, 'zh-CN', false)).toMatchObject({
      name: 'Source title'
    })
    expect(catalogLanguageFallback(record, 'zh-CN', false)).toEqual({
      source: 'en',
      fields: ['$.title', '$.description']
    })
  })
  it('keeps legacy projection values unchanged until their conversion is complete', () => {
    const legacy = { ...record, data: { type: 'CLOUD', name: 'Legacy' } }
    expect(catalogPresentation(legacy)).toBe(legacy.data)
    expect(catalogLanguageFallback(legacy, 'zh-CN', true)).toBeUndefined()
  })
})
