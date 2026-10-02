import { describe, expect, it } from 'vitest'

import type { FieldSchema } from '../../config/workshop-playground'
import { indexedUploadGroups } from './indexed-uploads'

function upload(
  name: string,
  label: string,
  media: 'image' | 'video' = 'image'
): FieldSchema {
  return {
    kind: 'text',
    name,
    label,
    required: false,
    multiline: false,
    presentation: {
      label,
      help: '',
      hidden: false,
      advanced: false,
      control: 'text-box',
      urlUpload: media
    }
  }
}

function text(name: string, label: string): FieldSchema {
  return { kind: 'text', name, label, required: false, multiline: false }
}

describe('indexedUploadGroups', () => {
  it('gathers a numbered run under the slot that starts it', () => {
    expect(
      indexedUploadGroups([
        text('prompt', 'Prompt'),
        upload('reference_image_url', 'Reference image'),
        upload('reference_image_url_2', 'Reference image 2'),
        upload('reference_image_url_3', 'Reference image 3')
      ])
    ).toEqual([
      {
        base: 'reference_image_url',
        label: 'Reference image',
        members: [
          'reference_image_url',
          'reference_image_url_2',
          'reference_image_url_3'
        ]
      }
    ])
  })

  it('leaves the frames and the source video alone', () => {
    expect(
      indexedUploadGroups([
        upload('first_frame_url', 'First frame'),
        upload('last_frame_url', 'Last frame'),
        upload('video_url', 'Source video', 'video')
      ])
    ).toEqual([])
  })

  it.for([
    {
      why: 'the run stops before the number it would need',
      fields: [upload('image_url', 'Image'), upload('image_url_3', 'Image 3')]
    },
    {
      why: 'a sibling is named for something else',
      fields: [upload('image_url', 'Image'), upload('image_url_2', 'Mask')]
    },
    {
      why: 'a sibling takes another kind of media',
      fields: [
        upload('image_url', 'Image'),
        upload('image_url_2', 'Image 2', 'video')
      ]
    },
    {
      why: 'the sibling is not an upload at all',
      fields: [upload('image_url', 'Image'), text('image_url_2', 'Image 2')]
    }
  ])('keeps the slots apart when $why', ({ fields }) => {
    expect(indexedUploadGroups(fields)).toEqual([])
  })

  it('gathers each run separately when a model has two', () => {
    expect(
      indexedUploadGroups([
        upload('reference_image_url', 'Reference image'),
        upload('reference_image_url_2', 'Reference image 2'),
        upload('mask_url', 'Mask'),
        upload('mask_url_2', 'Mask 2')
      ]).map((group) => group.members)
    ).toEqual([
      ['reference_image_url', 'reference_image_url_2'],
      ['mask_url', 'mask_url_2']
    ])
  })
})
