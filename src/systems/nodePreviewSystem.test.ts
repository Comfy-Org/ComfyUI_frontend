import { describe, expect, it } from 'vitest'

import type { AugmentedResultItem } from '@/utils/resultItem'

import { computeNodePreview } from './nodePreviewSystem'

type Sources = Parameters<typeof computeNodePreview>[0]

function item(mediaType: string, filename: string): AugmentedResultItem {
  return { mediaType, filename, nodeId: '7', subfolder: '' }
}

const png = item('images', 'still.png')
const webm = item('video', 'clip.webm')
const flac = item('audio', 'take.flac')
const mp4InImages = item('images', 'legacy.mp4')
const text = item('text', 'notes.txt')

const unhinted: Sources = {
  outputs: undefined,
  liveUrls: undefined,
  items: [],
  mediaTypeHint: undefined,
  hasVideoInput: false
}

describe(computeNodePreview, () => {
  it.for<{ when: string; sources: Partial<Sources>; media: unknown }>([
    {
      when: 'an animated non-webp output overrides an image hint',
      sources: {
        outputs: { animated: [true], images: [{ filename: 'legacy.mp4' }] },
        items: [mp4InImages, png],
        mediaTypeHint: 'image'
      },
      media: { type: 'video', items: [mp4InImages] }
    },
    {
      when: 'the node hints its media type',
      sources: { items: [png, flac], mediaTypeHint: 'audio' },
      media: { type: 'audio', items: [flac] }
    },
    {
      when: 'an unhinted node takes a VIDEO input',
      sources: { items: [png, webm], hasVideoInput: true },
      media: { type: 'video', items: [webm] }
    },
    {
      when: 'a VIDEO input meets a hint the rule does not render',
      sources: {
        items: [png, webm],
        hasVideoInput: true,
        mediaTypeHint: 'model'
      },
      media: { type: 'image', items: [png] }
    },
    {
      when: 'images sit next to other media',
      sources: { items: [webm, png, flac] },
      media: { type: 'image', items: [png] }
    },
    {
      when: 'only video results exist',
      sources: { items: [webm] },
      media: { type: 'video', items: [webm] }
    },
    {
      when: 'only audio results exist',
      sources: { items: [flac] },
      media: { type: 'audio', items: [flac] }
    },
    {
      when: 'no result is media',
      sources: { items: [text] },
      media: undefined
    }
  ])('chooses media when $when', ({ sources, media }) => {
    expect(computeNodePreview({ ...unhinted, ...sources }).media).toEqual(media)
  })

  it('reports the latest live frame next to the output media', () => {
    expect(
      computeNodePreview({
        ...unhinted,
        items: [png],
        liveUrls: ['blob:first', 'blob:latest']
      })
    ).toEqual({
      liveUrl: 'blob:latest',
      media: { type: 'image', items: [png] }
    })
  })
})
