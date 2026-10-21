import { describe, expect, it } from 'vitest'

import { translationsFor } from '@/i18n/translations'

import { showcaseConfig, workflowNode } from './vfxConnectedShowcase'

describe('showcaseConfig', () => {
  it.for([
    {
      demo: 'relight',
      source: 'diner',
      mediaKind: 'video',
      workflowHref: 'https://cloud.comfy.org/?share=8b18c850d38a',
      firstVariant: 'relight_golden'
    },
    {
      demo: 'swap',
      source: 'backlot',
      mediaKind: 'video',
      workflowHref: 'https://cloud.comfy.org/?share=28fa6219c110',
      firstVariant: 'swap_jp'
    },
    {
      demo: 'reframe',
      source: 'forest',
      mediaKind: 'image',
      workflowHref: 'https://cloud.comfy.org/?share=ccfd0e7d75c3',
      firstVariant: 'reframe_wide'
    },
    {
      demo: 'sequence',
      source: 'rain',
      mediaKind: 'video',
      workflowHref: 'https://cloud.comfy.org/?share=c2191c018939',
      firstVariant: 'seedance_multishot_rain'
    }
  ] as const)('connects the $demo source to its available workflow', (row) => {
    const config = showcaseConfig(row.demo, translationsFor('en').t)

    expect(config).toMatchObject({
      source: row.source,
      mediaKind: row.mediaKind,
      workflowHref: row.workflowHref
    })
    expect(config.variants[0].id).toBe(row.firstVariant)
  })

  it('keeps the sequence reference still independent of its generated output', () => {
    const { original, keyframe, preview } = showcaseConfig(
      'sequence',
      translationsFor('en').t
    )

    expect(original).toMatchObject({ video: 'rain.mp4', poster: 'rain.jpg' })
    expect(keyframe).toMatchObject({
      image: 'rain.jpg',
      label: 'Reference frame'
    })
    expect(keyframe.video).toBeUndefined()
    expect(preview).toMatchObject({ video: 'seedance_multishot_rain.mp4' })
  })

  it('keeps reframe source and output as images', () => {
    const { original, keyframe, preview } = showcaseConfig(
      'reframe',
      translationsFor('en').t
    )

    expect(
      [original, keyframe, preview].map(({ image, video }) => ({
        image,
        video
      }))
    ).toEqual([
      { image: 'forest.jpg', video: undefined },
      { image: 'reframe_wide.jpg', video: undefined },
      { image: 'reframe_wide.jpg', video: undefined }
    ])
  })

  it('localizes original footage and selected variant with the supplied translator', () => {
    const { original, preview, variants } = showcaseConfig(
      'relight',
      translationsFor('zh-CN').t
    )

    expect(original.label).toBe('原始素材')
    expect(preview.label).toBe('黄金时刻')
    expect(variants[0].label).toBe('黄金时刻')
  })
})

describe('workflowNode', () => {
  it.for([
    {
      mediaKind: 'video',
      media: { video: 'shot.mp4', poster: 'shot.jpg', loopVideo: true }
    },
    { mediaKind: 'image', media: { image: 'shot.jpg' } }
  ] as const)('renders a $mediaKind node', ({ mediaKind, media }) => {
    const node = workflowNode(mediaKind, 'shot', 'Shot', 'shot.jpg')

    expect(node).toMatchObject(media)
    expect(node.video === undefined).toBe(mediaKind === 'image')
  })

  it('leaves media absent when none was supplied', () => {
    const node = workflowNode('video', 'empty', 'Empty')

    expect(node.image).toBeUndefined()
    expect(node.video).toBeUndefined()
    expect(node.poster).toBeUndefined()
  })
})
