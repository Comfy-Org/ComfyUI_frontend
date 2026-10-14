import type { ContentCatalogRecord } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'
import { detailSchema } from '@/config/models-page-data'
import { modelSchema } from '@/config/models-catalogue-data'
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
    inputs: {
      quality: {
        label: 'Quality',
        help: '',
        hidden: false,
        advanced: false,
        control: 'dropdown'
      }
    },
    examples: [
      { name: 'example', title: 'Authored example', values: { quality: 2 } }
    ],
    translations: { 'zh-CN': { title: '本地标题', review_state: 'machine' } },
    website_media: { '$.hero': '/preview-media/2/logical-use/exact-bytes' }
  }
}
describe('native CONTENT presentation', () => {
  it.each(['video/mp4', 'video/webm'])(
    'uses exact verified %s metadata for native hero playback',
    (mime) => {
      const view = catalogPresentation({
        ...record,
        data: {
          ...record.data,
          website_media_types: { '$.hero': mime },
          presentation: { thumbnailKind: 'image' }
        }
      })
      expect(view).toMatchObject({
        thumbnail: {
          kind: 'video',
          url: '/preview-media/2/logical-use/exact-bytes'
        }
      })
    }
  )
  it('renders verified example videos without changing execution values', () => {
    const view = catalogPresentation({
      ...record,
      data: {
        ...record.data,
        website_media: {
          '$.examples[0].media': '/preview-media/2/example/file'
        },
        website_media_types: { '$.examples[0].media': 'video/webm' }
      }
    })
    expect(view).toMatchObject({
      examples: [
        {
          mediaKind: 'video',
          thumbnailUrl: '/preview-media/2/example/file',
          values: { quality: 2 }
        }
      ]
    })
  })
  it('preserves explicit download-only and stored script facts only in detail data', () => {
    const view = catalogPresentation({
      ...record,
      data: {
        ...record.data,
        runnable: false,
        script_code: { python: 'print("Example")' }
      }
    })
    expect(detailSchema.parse(view)).toMatchObject({
      catalogDetails: {
        runnable: false,
        scriptCode: { python: 'print("Example")' }
      }
    })
    expect(modelSchema.parse(view)).not.toHaveProperty('catalogDetails')
  })
  it('maps only server-resolved file downloads and valid Cloud/doc links into detail metadata', () => {
    const uid = '00000000-0000-4000-8000-000000000080'
    const version = '00000000-0000-4000-8000-000000000081'
    const href = `/preview-media/2/${uid}/${version}`
    const data = {
      ...record.data,
      workflow_files: [
        {
          name: 'Version one',
          file: { src: 'r2', id: uid, file_version_uid: version }
        }
      ],
      cloud_share_url: 'https://cloud.comfy.org/?share=abcdef123456',
      documentation_url: 'https://docs.comfy.org/api-reference/',
      website_media: { '$.workflow_files[0].file': href }
    }
    expect(
      detailSchema.parse(catalogPresentation({ ...record, data }))
    ).toMatchObject({
      catalogDetails: {
        cloudShareURL: data.cloud_share_url,
        documentationURL: data.documentation_url,
        workflowFiles: [{ name: 'Version one', uid, version, href }]
      }
    })
    expect(
      detailSchema.parse(
        catalogPresentation({
          ...record,
          data: {
            ...data,
            website_media: {},
            cloud_share_url: 'https://evil.test/',
            documentation_url: 'javascript:alert(1)'
          }
        })
      )
    ).toMatchObject({
      catalogDetails: {
        workflowFiles: [],
        cloudShareURL: undefined,
        documentationURL: undefined
      }
    })
  })
  it('keeps body/FAQ and detail facts out of bounded list cards', () => {
    const view = catalogPresentation({
      ...record,
      data: {
        ...record.data,
        long_description: 'Long detail body',
        faq: [{ question: 'Question', answer: 'Answer' }]
      }
    })
    expect(modelSchema.parse(view)).not.toHaveProperty('catalogDetails')
    expect(detailSchema.parse(view)).toHaveProperty(
      'catalogDetails.longDescription',
      'Long detail body'
    )
  })
  it('carries authored workflow facts, descriptions and FAQ through the page decoder without changing identity', () => {
    const modelUID = '00000000-0000-4000-8000-000000000099'
    const authored = {
      ...record,
      data: {
        ...record.data,
        long_description: 'First paragraph.\n\nSecond paragraph.',
        faq: [
          { question: 'Can I edit it?', answer: 'Yes, download the workflow.' }
        ],
        works_on_cloud: false,
        output_type: 'video',
        runs: 0,
        downloads: 12,
        author_uid: modelUID,
        model_uids: [modelUID]
      }
    }
    const referenced = {
      ...record,
      uid: modelUID,
      slug: '/hub/models/verified-model',
      data: {
        type: 'model',
        title: 'Verified model',
        translations: {
          'zh-CN': { title: '已确认模型', review_state: 'reviewed' }
        }
      }
    }
    const decoded = detailSchema.parse(
      catalogPresentation(authored, 'en', true, [referenced])
    )
    expect(decoded).toMatchObject({
      catalogDetails: {
        longDescription: 'First paragraph.\n\nSecond paragraph.',
        faqs: [
          { question: 'Can I edit it?', answer: 'Yes, download the workflow.' }
        ],
        worksOnCloud: false,
        outputType: 'video',
        runs: 0,
        downloads: 12,
        author: modelUID,
        models: [
          {
            uid: modelUID,
            name: 'Verified model',
            href: '/hub/models/verified-model/'
          }
        ]
      }
    })
    expect(
      catalogPresentation(authored, 'zh-CN', false, [referenced])
    ).toMatchObject({
      catalogDetails: {
        models: [
          { name: '已确认模型', href: '/zh-CN/hub/models/verified-model/' }
        ]
      }
    })
  })

  it('omits empty text and incomplete FAQ pairs, retaining zero and false', () => {
    const empty = {
      ...record,
      data: {
        ...record.data,
        long_description: ' \n ',
        faq: [
          { question: '', answer: 'Answer' },
          { question: 'Question', answer: ' ' }
        ],
        works_on_cloud: false,
        runs: 0,
        downloads: '',
        author_uid: ' ',
        model_uids: []
      }
    }
    expect(catalogPresentation(empty)).toMatchObject({
      catalogDetails: {
        longDescription: undefined,
        faqs: [],
        models: [],
        author: undefined,
        worksOnCloud: false,
        runs: 0,
        downloads: undefined
      }
    })
  })

  it('requires reviewed body/FAQ translations in LIVE and never guesses missing model identity', () => {
    const authored = {
      ...record,
      data: {
        ...record.data,
        long_description: 'Source body',
        faq: [{ question: 'Source question', answer: 'Source answer' }],
        model_uids: ['00000000-0000-4000-8000-000000000098'],
        translations: {
          'zh-CN': {
            review_state: 'machine',
            long_description: '译文',
            faq: [{ question: '问题', answer: '回答' }]
          }
        }
      }
    }
    expect(catalogPresentation(authored, 'zh-CN', false)).toMatchObject({
      catalogDetails: {
        longDescription: 'Source body',
        faqs: [{ question: 'Source question' }],
        models: [{ name: '00000000-0000-4000-8000-000000000098' }]
      }
    })
    expect(catalogPresentation(authored, 'zh-CN', true)).toMatchObject({
      catalogDetails: {
        longDescription: '译文',
        faqs: [{ question: '问题', answer: '回答' }]
      }
    })
  })
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
