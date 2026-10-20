import { describe, expect, it } from 'vitest'

import type { PlaygroundExample } from '@/config/workshop-playground'

import { sampleMedia } from './node-graph-workflow'

const sample = (
  outputUrl: string,
  mediaKind?: PlaygroundExample['mediaKind']
) => ({
  id: 'sample',
  title: 'Sample',
  specs: [],
  values: {},
  outputUrl,
  sampleOnly: true,
  ...(mediaKind ? { mediaKind } : {})
})

describe('sampleMedia', () => {
  it.for([
    {
      name: 'trusts a declared kind',
      example: sample('/a.png', 'audio'),
      media: 'audio'
    },
    {
      name: 'reads a video URL',
      example: sample('/clip.mp4?v=2'),
      media: 'video'
    },
    {
      name: 'reads an audio URL',
      example: sample('/voice.mp3'),
      media: 'audio'
    },
    {
      name: 'falls back to an image',
      example: sample('/sheet.webp'),
      media: 'image'
    }
  ])('$name', ({ example, media }) => {
    expect(sampleMedia(example)).toBe(media)
  })
})
