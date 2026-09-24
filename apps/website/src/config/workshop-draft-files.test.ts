import { describe, expect, it } from 'vitest'

import { packWorkshopFiles, restoreWorkshopFiles } from './workshop-draft-files'
import type { FieldSchema } from './workshop-playground'
import { workshopExampleFile } from './workshop-example-file'

const schema: FieldSchema[] = [
  {
    kind: 'file',
    name: 'images',
    label: 'Reference images',
    required: true,
    multiple: true,
    maxItems: 2,
    accept: ['image/webp'],
    maxBytes: 10
  }
]
const file = new File(['pixels'], 'photo.webp', { type: 'image/webp' })
const selected = {
  file,
  name: file.name,
  type: file.type,
  size: file.size,
  previewUrl: 'blob:old-document'
}

describe('sign-in media drafts', () => {
  it('keeps embedded media runnable in API examples after sign-in', async () => {
    const sourceDataUrl = 'data:image/webp;base64,' + btoa('pixels')
    const packed = packWorkshopFiles(schema, {
      images: [{ ...selected, sourceDataUrl }]
    })
    const restored = restoreWorkshopFiles(schema, packed).images
    if (!Array.isArray(restored)) throw new Error('Missing references')
    expect(await restored[0].file?.text()).toBe('pixels')
    expect(restored[0].sourceDataUrl).toBe(sourceDataUrl)
  })

  it('retains original bytes and reference order without retaining document-owned blob URLs', async () => {
    const remote = workshopExampleFile('https://example.com/reference.webp')
    if (!remote) throw new Error('Invalid fixture')
    const packed = packWorkshopFiles(schema, {
      images: [remote, selected],
      prompt: 'Private prompt'
    })
    expect(packed).toEqual({ images: [remote.sourceUrl, file] })
    const restored = restoreWorkshopFiles(schema, packed).images
    if (!Array.isArray(restored)) throw new Error('Missing references')
    expect(restored[0].sourceUrl).toBe(remote.sourceUrl)
    expect(await restored[1].file?.text()).toBe('pixels')
    expect(restored[1].previewUrl).toBeUndefined()
  })

  it('preserves a deliberately cleared required input instead of restoring the page default', () => {
    expect(
      restoreWorkshopFiles(
        schema,
        packWorkshopFiles(schema, { images: undefined })
      )
    ).toEqual({ images: undefined })
  })

  it.for([
    { images: [{ name: 'photo.webp', size: 6, type: 'image/webp' }] },
    { images: ['blob:old-document'] },
    { images: [file, file, file] },
    {
      images: [
        new File(['too many pixels'], 'large.webp', { type: 'image/webp' })
      ]
    },
    {
      images: [new File(['not an image'], 'script.html', { type: 'text/html' })]
    }
  ])('rejects unusable or out-of-contract stored references: %j', (stored) => {
    expect(() => restoreWorkshopFiles(schema, stored)).toThrow(
      'Invalid media draft'
    )
  })

  it('restores a local file in a URL-upload field while validating remote URLs', () => {
    const field: FieldSchema = {
      kind: 'text',
      name: 'source_uri',
      label: 'Source image',
      multiline: false,
      required: true,
      presentation: {
        label: 'Source image',
        help: '',
        control: 'text-box',
        advanced: false,
        hidden: false,
        urlUpload: 'image'
      }
    }
    const restored = restoreWorkshopFiles(
      [field],
      packWorkshopFiles([field], { source_uri: selected })
    )
    expect(restored.source_uri).toEqual({
      file,
      name: file.name,
      type: file.type,
      size: file.size
    })
    expect(() =>
      restoreWorkshopFiles([field], { source_uri: 'javascript:alert(1)' })
    ).toThrow('Invalid media draft')
  })
})
