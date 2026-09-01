import { describe, expect, it } from 'vitest'

import {
  categoryChapters,
  filterByCategory,
  learningCategories,
  learningKeywords,
  learningMetaDescription,
  learningMetaTitle,
  learningTutorials,
  recommendedFor,
  tutorialMetaTitle,
  youtubeEmbedUrl
} from './learningTutorials'

const firstVfx = filterByCategory('vfx')[0]
const secondVfx = filterByCategory('vfx')[1]

describe('episode numbering', () => {
  it('is unique within every category', () => {
    for (const category of learningCategories) {
      const episodes = filterByCategory(category).map((item) => item.episode)
      expect(new Set(episodes).size).toBe(episodes.length)
    }
  })

  it('starts at 1 in every populated category', () => {
    for (const category of learningCategories) {
      const episodes = filterByCategory(category).map((item) => item.episode)
      if (episodes.length) expect(Math.min(...episodes)).toBe(1)
    }
  })
})

describe('categoryChapters', () => {
  it('lists same-category siblings excluding the tutorial itself', () => {
    const chapters = categoryChapters(firstVfx)
    expect(chapters).toHaveLength(filterByCategory('vfx').length - 1)
    expect(chapters).not.toContainEqual(firstVfx)
    expect(chapters.every((item) => item.category === 'vfx')).toBe(true)
  })

  it('sorts by episode number', () => {
    const episodes = categoryChapters(firstVfx).map((item) => item.episode)
    expect(episodes).toEqual([...episodes].sort((a, b) => a - b))
    expect(categoryChapters(firstVfx)[0]).toEqual(secondVfx)
  })
})

describe('video source', () => {
  it('plays via exactly one of videoSrc or youtubeId', () => {
    for (const tutorial of learningTutorials) {
      expect(Boolean(tutorial.videoSrc) !== Boolean(tutorial.youtubeId)).toBe(
        true
      )
    }
  })

  it('builds a privacy-friendly nocookie embed URL from an id', () => {
    expect(youtubeEmbedUrl('abc123')).toBe(
      'https://www.youtube-nocookie.com/embed/abc123?autoplay=1&mute=1&rel=0'
    )
  })
})

describe('basics CTA', () => {
  it('sends basics tutorials to cloud signup with a Try for Free label', () => {
    const basics = filterByCategory('basics')
    expect(basics.length).toBeGreaterThan(0)
    for (const tutorial of basics) {
      expect(tutorial.href).toMatch(
        /^https:\/\/cloud\.comfy\.org\/\?.*utm_campaign=free_tier.*utm_content=learning_basics_/
      )
      expect(tutorial.newTab).toBe(true)
      expect(tutorial.ctaLabelKey).toBe('cta.tryForFree')
    }
  })
})

describe('recommendedFor', () => {
  it('only recommends tutorials from other categories', () => {
    const recommended = recommendedFor(firstVfx)
    expect(recommended.length).toBeGreaterThan(0)
    expect(recommended.every((item) => item.category !== 'vfx')).toBe(true)
  })

  it('respects the limit', () => {
    expect(recommendedFor(firstVfx, 3)).toHaveLength(3)
    expect(recommendedFor(firstVfx, 1)).toHaveLength(1)
    expect(recommendedFor(firstVfx, learningTutorials.length).length).toBe(
      learningTutorials.length - filterByCategory('vfx').length
    )
  })
})

describe('directory meta', () => {
  const expected = {
    en: {
      root: {
        title: 'ComfyUI Tutorials: Free Video Series from Basics to VFX',
        description:
          'Learn ComfyUI with free video tutorials and the workflows behind them. Start with the node graph basics, then move into VFX, animation, and ad creative.'
      },
      basics: {
        title: 'ComfyUI Basics for Beginners: Node Graph, LoRAs, ControlNet',
        description:
          'Free ComfyUI tutorials for beginners. Learn the node graph first, then add LoRAs, style transfer, and ControlNets, with a workflow to open at every step.'
      },
      vfx: {
        title: 'ComfyUI VFX Tutorials: Cleanplates, Sky Replacement, Deaging',
        description:
          'Free ComfyUI VFX tutorials with the workflows behind them: cleanplates, sky replacement, deaging, mattes, and frame adjustments for your own shots.'
      },
      animations: {
        title: 'ComfyUI Animation Tutorials: Character Sheets and Keyframes',
        description:
          'Free ComfyUI animation tutorials with workflows: character sheets, keyframes, in-betweening, backgrounds, and compositing, from concept art to final shot.'
      },
      ads: {
        title: 'ComfyUI Ad Creative Tutorials: Moodboards to Product Shots',
        description:
          'Free ComfyUI tutorials for ad creative, each with its workflow: moodboards, storyboards, product photography, talent casting, B-roll, and OOH mockups.'
      }
    },
    'zh-CN': {
      root: {
        title: 'ComfyUI 教程：免费视频系列，从基础到 VFX',
        description:
          '通过免费视频教程和配套工作流学习 ComfyUI。从节点图基础开始，再进入 VFX、动画与广告创意。'
      },
      basics: {
        title: 'ComfyUI 基础教程：节点图、LoRA 与 ControlNet 新手入门',
        description:
          '面向初学者的免费 ComfyUI 教程。先学节点图，再加入 LoRA、风格迁移与 ControlNet，每一步都有可打开的工作流。'
      },
      vfx: {
        title: 'ComfyUI VFX 教程：净板、天空替换与减龄',
        description:
          '免费 ComfyUI VFX 教程与配套工作流：净板、天空替换、减龄、遮罩与帧调整，可用于你自己的镜头。'
      },
      animations: {
        title: 'ComfyUI 动画教程：角色设定表与关键帧',
        description:
          '免费 ComfyUI 动画教程与工作流：角色设定表、关键帧、中间帧、背景与合成，从概念美术到完成镜头。'
      },
      ads: {
        title: 'ComfyUI 广告创意教程：从情绪板到产品摄影',
        description:
          '面向广告创意的免费 ComfyUI 教程，每个都配有工作流：情绪板、故事板、产品摄影、演员预演、B-Roll 与户外广告样机。'
      }
    }
  } as const

  for (const locale of ['en', 'zh-CN'] as const) {
    it(`renders the ${locale} root title and description`, () => {
      expect(learningMetaTitle(locale)).toBe(expected[locale].root.title)
      expect(learningMetaDescription(locale)).toBe(
        expected[locale].root.description
      )
    })

    for (const category of learningCategories) {
      it(`renders the ${locale} ${category} title and description`, () => {
        expect(learningMetaTitle(locale, category)).toBe(
          expected[locale][category].title
        )
        expect(learningMetaDescription(locale, category)).toBe(
          expected[locale][category].description
        )
      })
    }
  }

  it('keeps en meta copy free of em dashes', () => {
    for (const category of [undefined, ...learningCategories]) {
      expect(learningMetaTitle('en', category)).not.toContain('—')
      expect(learningMetaDescription('en', category)).not.toContain('—')
    }
  })

  it('emits keywords for the root page only', () => {
    expect(learningKeywords()).toContain('comfyui tutorial')
    for (const category of learningCategories) {
      expect(learningKeywords(category)).toBeUndefined()
    }
  })
})

describe('tutorialMetaTitle', () => {
  const basics = filterByCategory('basics')[0]

  it('appends the tutorial suffix per locale', () => {
    expect(tutorialMetaTitle(firstVfx, 'en')).toBe(
      `${firstVfx.title.en}: Free ComfyUI Tutorial`
    )
    expect(tutorialMetaTitle(firstVfx, 'zh-CN')).toBe(
      `${firstVfx.title['zh-CN']}：免费 ComfyUI 教程`
    )
  })

  it('leaves titles that already name ComfyUI untouched', () => {
    expect(basics.title.en).toContain('ComfyUI')
    expect(tutorialMetaTitle(basics, 'en')).toBe(basics.title.en)
    expect(basics.title['zh-CN']).toContain('ComfyUI')
    expect(tutorialMetaTitle(basics, 'zh-CN')).toBe(basics.title['zh-CN'])
  })
})
