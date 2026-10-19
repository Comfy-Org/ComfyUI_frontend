import type { ContentCatalogRecord } from '@comfyorg/ingest-types'
import { describe, expect, it } from 'vitest'
import { detailSchema } from '@/config/models-page-data'
import { modelSchema } from '@/config/models-catalogue-data'
import { useCasesFor } from '@/config/models-catalogue'
import { workflowCloudRequest } from '@/config/workshop-workflow-api'
import { examplesForModel } from '@/config/workshop-playground'
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
  it('keeps a local model readable without inventing a router or execution contract', () => {
    const model = detailSchema.parse(
      catalogPresentation({
        ...record,
        kind: 'MODEL',
        slug: '/hub/models/local-model',
        data: {
          type: 'model',
          slug: 'local-model',
          title: 'Local model',
          description: 'Run locally',
          use_cases: ['generate-images', 'edit-images'],
          compatibility: {
            website: { routerId: 'stale/router', useCases: ['audio'] }
          }
        }
      })
    )
    expect(model).toMatchObject({ type: 'MODEL', name: 'Local model' })
    expect(model.routerId).toBeUndefined()
    expect(model).not.toHaveProperty('execution')
    expect(useCasesFor(model)).toEqual(['generate-images', 'edit-images'])
  })

  it.for([
    {
      type: 'model',
      use_cases: ['audio'],
      generation_type: undefined,
      expected: ['audio']
    },
    {
      type: 'workflow',
      use_cases: ['product-photos'],
      generation_type: 'edit-images',
      expected: ['edit-images']
    }
  ])(
    'uses canonical $type classification instead of legacy website metadata',
    ({ type, use_cases, generation_type, expected }) => {
      const model = modelSchema.parse(
        catalogPresentation({
          ...record,
          data: {
            ...record.data,
            type,
            use_cases,
            ...(generation_type ? { generation_type } : {}),
            compatibility: { website: { useCases: ['generate-videos'] } }
          }
        })
      )
      expect(useCasesFor(model)).toEqual(expected)
    }
  )
  it('keeps the full-page source distinct from a resolved exact still thumbnail', () => {
    const view = detailSchema.parse(
      catalogPresentation({
        ...record,
        data: {
          ...record.data,
          website_media: {
            '$.hero': '/preview-media/7/source/exact-version',
            '$.static_thumb': '/preview-media/7/thumb/exact-version'
          },
          website_media_types: {
            '$.hero': 'video/mp4',
            '$.static_thumb': 'image/webp'
          }
        }
      })
    )
    expect(view.thumbnail).toEqual({
      url: '/preview-media/7/source/exact-version',
      kind: 'video',
      poster: '/preview-media/7/thumb/exact-version',
      staticUrl: '/preview-media/7/thumb/exact-version'
    })
  })
  it('does not echo account IDs or accept mismatched profile/avatar metadata', () => {
    const uid = '00000000-0000-4000-8000-000000000096'
    const view = detailSchema.parse(
      catalogPresentation({
        ...record,
        data: {
          ...record.data,
          author_uid: uid,
          website_author: {
            uid: 'other-account',
            name: 'Wrong person',
            avatar_url: 'https://media.comfy.org/other.png'
          }
        }
      })
    )
    expect(view).toMatchObject({
      catalogDetails: { author: 'Author unavailable' }
    })
    expect(view).not.toHaveProperty('catalogDetails.authorAvatarURL')
    const invalidAvatar = detailSchema.parse(
      catalogPresentation({
        ...record,
        data: {
          ...record.data,
          author_uid: uid,
          website_author: {
            uid,
            name: 'Actual author',
            avatar_url: 'javascript:alert(1)'
          }
        }
      })
    )
    expect(invalidAvatar).toMatchObject({
      catalogDetails: { author: 'Actual author' }
    })
    expect(invalidAvatar).not.toHaveProperty('catalogDetails.authorAvatarURL')
  })
  it('uses only named pair zero: download graph and independent API prompt for Run', () => {
    const download = '00000000-0000-4000-8000-000000000080'
    const api = '00000000-0000-4000-8000-000000000081'
    const version = '00000000-0000-4000-8000-000000000082'
    const file = (id: string) => ({ src: 'r2', id, file_version_uid: version })
    const view = detailSchema.parse(
      catalogPresentation({
        ...record,
        data: {
          ...record.data,
          workflow_versions: [
            { name: 'V1', download: file(download), api: file(api) },
            { name: 'Ignore future', download: file(api), api: file(download) }
          ],
          website_media: {
            '$.workflow_versions[0].download': `/preview-media/2/${download}/${version}`,
            '$.workflow_versions[0].api': `/preview-media/2/${api}/${version}`,
            '$.workflow_versions[1].api': `/preview-media/2/${download}/${version}`,
            '$.workflow_versions[1].download': `/preview-media/2/${api}/${version}`
          },
          website_api_workflow: {
            '7': { class_type: 'Example', inputs: { quality: 1 } }
          },
          inputBindings: {
            quality: {
              encoding: 'scalar',
              targets: [{ nodeId: '7', inputName: 'quality' }]
            }
          }
        }
      })
    )
    if (view.type !== 'CLOUD') throw new Error('Not workflow detail')
    expect(view.catalogDetails?.workflowFiles).toEqual([
      {
        name: 'V1',
        uid: download,
        version,
        href: `/preview-media/2/${download}/${version}`
      }
    ])
    expect(view.catalogDetails?.apiWorkflowFile).toEqual({
      name: 'V1',
      uid: api,
      version,
      href: `/preview-media/2/${api}/${version}`
    })
    expect(
      workflowCloudRequest(view.workflow, {
        workflowId: view.workflow.id,
        definitionVersion: view.workflow.definitionVersion,
        appInputs: { quality: 2 }
      })
    ).toMatchObject({
      prompt: { '7': { class_type: 'Example', inputs: { quality: 2 } } }
    })
    expect(view.workflow.cloud?.workflow['7'].inputs.quality).toBe(1)
  })
  it('never substitutes a legacy inline API when the primary pair API is unavailable', () => {
    const view = detailSchema.parse(
      catalogPresentation({
        ...record,
        data: {
          ...record.data,
          runnable: true,
          workflow_versions: [],
          website_api_workflow: null,
          compatibility: {
            website: {
              workflow: {
                cloud: {
                  workflow: { '7': { class_type: 'Legacy', inputs: {} } },
                  inputBindings: {}
                }
              }
            }
          }
        }
      })
    )
    if (view.type !== 'CLOUD') throw new Error('Not workflow detail')
    expect(view.workflow.cloud).toBeUndefined()
    expect(view.catalogDetails?.apiWorkflowFile).toBeUndefined()
    expect(view.catalogDetails?.runnable).toBe(false)
  })
  it.for(['video/mp4', 'video/webm'])(
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
  it.for(['video/mp4', 'video/webm'])(
    'preserves verified %s on extensionless examples through the actual page schemas',
    (mime) => {
      const view = catalogPresentation({
        ...record,
        data: {
          ...record.data,
          website_media: {
            '$.examples[0].media': '/preview-media/2/example/file'
          },
          website_media_types: { '$.examples[0].media': mime }
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
      const detail = detailSchema.parse(view)
      expect(examplesForModel(detail)).toMatchObject([
        {
          mediaKind: 'video',
          outputUrl: '/preview-media/2/example/file',
          values: { quality: 2 }
        }
      ])
    }
  )
  it('classifies audio heroes and examples as audio', () => {
    const view = catalogPresentation({
      ...record,
      data: {
        ...record.data,
        website_media: {
          '$.hero': '/catalog-media/hero/song',
          '$.examples[0].media': '/catalog-media/example/song'
        },
        website_media_types: {
          '$.hero': 'audio/mpeg',
          '$.examples[0].media': 'audio/wav'
        }
      }
    })
    expect(view).toMatchObject({
      thumbnail: { kind: 'audio' },
      examples: [{ mediaKind: 'audio' }]
    })
    expect(view).not.toHaveProperty('thumbnailUrl')
  })
  it('does not reuse old video presentation when the selected file becomes an image', () => {
    const view = catalogPresentation({
      ...record,
      data: {
        ...record.data,
        website_media_types: { '$.hero': 'image/png' },
        presentation: { thumbnailKind: 'video' }
      }
    })
    expect(view).toMatchObject({ thumbnail: { kind: 'image' } })
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
        website_author: {
          uid: modelUID,
          name: 'Comfy creator',
          username: 'comfy-creator',
          avatar_url: 'https://media.comfy.org/creator.png'
        },
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
        author: 'Comfy creator',
        authorAvatarURL: 'https://media.comfy.org/creator.png',
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
        models: [{ name: '模型信息暂不可用' }]
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
  it('shows a reviewed Japanese translation in LIVE and falls back per field', () => {
    const japanese = {
      ...record,
      data: {
        ...record.data,
        tags: ['image'],
        translations: {
          'zh-CN': { title: '本地标题', review_state: 'machine' },
          ja: {
            title: '画像から動画へ',
            tags: ['画像'],
            faq: [{ question: '使い方は？', answer: '説明に従ってください。' }],
            review_state: 'reviewed'
          }
        }
      }
    }
    const view = catalogPresentation(japanese, 'ja', false)
    expect(view).toMatchObject({
      name: '画像から動画へ',
      summary: 'Source description',
      capabilities: ['画像']
    })
    expect(JSON.stringify(view)).toContain('使い方は？')
    expect(catalogLanguageFallback(japanese, 'ja', false)).toEqual({
      source: 'en',
      fields: ['$.description']
    })
    expect(catalogPresentation(japanese, 'en', false)).toMatchObject({
      name: 'Source title',
      capabilities: ['image']
    })
  })
  it('keeps machine Japanese out of LIVE but shows it in Draft preview', () => {
    const machine = {
      ...record,
      data: {
        ...record.data,
        translations: { ja: { title: '機械翻訳', review_state: 'machine' } }
      }
    }
    expect(catalogPresentation(machine, 'ja', false)).toMatchObject({
      name: 'Source title'
    })
    expect(catalogPresentation(machine, 'ja', true)).toMatchObject({
      name: '機械翻訳'
    })
  })
  it('keeps legacy projection values unchanged until their conversion is complete', () => {
    const legacy = { ...record, data: { type: 'CLOUD', name: 'Legacy' } }
    expect(catalogPresentation(legacy)).toBe(legacy.data)
    expect(catalogLanguageFallback(legacy, 'zh-CN', true)).toBeUndefined()
  })
})
