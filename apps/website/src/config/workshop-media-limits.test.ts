import { assert, describe, expect, it } from 'vitest'

import { initialWorkshopPageState } from './workshop-page-state'
import { getAuthoredRouterWorkshopModelDetail as getRouterWorkshopModelDetail } from './workshop-router-content'
import { validateForm } from './workshop-playground'
import type { FieldSchema } from './workshop-playground'
import { prepareWorkshopRouterInput } from './workshop-request'

it('does not double-encode a raw JSON editor when estimating inline files', () => {
  const schema: FieldSchema[] = [
    {
      kind: 'text',
      name: 'request_body',
      label: 'Request body',
      required: true,
      multiline: true,
      valueType: 'json',
      jsonSchema: { type: 'object' }
    }
  ]
  const request_body = JSON.stringify({ text: '"'.repeat(3_000_000) })
  expect(validateForm(schema, { request_body })).toEqual({})
})

describe('inline image request budget: byteplus--seedream-4-5--edit-images', () => {
  const slug = 'byteplus--seedream-4-5--edit-images'

  it.for([
    { sizes: [8_388_608], expected: { images: 'requestTooLarge' } },
    { sizes: [4_194_304, 4_194_304], expected: { images: 'requestTooLarge' } },
    { sizes: [3_145_728, 3_145_728], expected: {} }
  ])(
    'validates the aggregate encoded budget for $sizes',
    ({ sizes, expected }) => {
      const model = getRouterWorkshopModelDetail(slug)
      assert.exists(model)
      const { schema, values } = initialWorkshopPageState(model)
      expect(
        validateForm(schema, {
          ...values,
          images: sizes.map((size) => ({
            name: 'image.png',
            size,
            type: 'image/png'
          }))
        })
      ).toEqual(expected)
    }
  )
})

it('excludes URL-uploaded Gemini images from the inline request budget', () => {
  const model = getRouterWorkshopModelDetail(
    'vertexai--gemini-3-pro-image--edit-images'
  )
  assert.exists(model)
  const { schema, values } = initialWorkshopPageState(model)
  expect(
    validateForm(schema, {
      ...values,
      images: [8_388_608, 4_194_304].map((size) => ({
        name: 'image.png',
        size,
        type: 'image/png'
      }))
    })
  ).toEqual({})
})

describe.for([
  'wan--reference-video--edit-videos',
  'wan--video-edit-2.7--edit-videos'
])('WAN video uploads: %s', (slug) => {
  it.for([
    { size: 40_000_000, expected: {} },
    { size: 100_000_000, expected: {} },
    { size: 100_000_001, expected: { video_url: 'tooLarge' } }
  ])(
    'validates $size bytes against the model upload limit',
    ({ size, expected }) => {
      const model = getRouterWorkshopModelDetail(slug)
      assert.exists(model)
      const { schema, values } = initialWorkshopPageState(model)
      expect(
        validateForm(schema, {
          ...values,
          video_url: { name: 'reference.mp4', size, type: 'video/mp4' }
        })
      ).toEqual(expected)
    }
  )

  it('sends an uploaded video URL without embedding its bytes', async () => {
    const model = getRouterWorkshopModelDetail(slug)
    assert.exists(model)
    const { values } = initialWorkshopPageState(model)
    const body = await prepareWorkshopRouterInput(
      model.execution,
      {
        ...values,
        video_url: 'https://media.example/reference.mp4'
      },
      new AbortController().signal
    )
    expect(body.input).toMatchObject(
      slug.includes('reference-video')
        ? { reference_video_urls: ['https://media.example/reference.mp4'] }
        : {
            media: [
              { type: 'video', url: 'https://media.example/reference.mp4' }
            ]
          }
    )
  })
})
