import { describe, expect, it } from 'vitest'

import type { HubWorkflowIndexEntry } from '../schemas/hubWorkflowIndexSchema'
import {
  mapHubWorkflowIndexEntryToTemplate,
  mapHubWorkflowIndexToCategories
} from './hubWorkflowIndexMapper'

const makeEntry = (
  overrides?: Partial<HubWorkflowIndexEntry>
): HubWorkflowIndexEntry => ({
  name: 'sdxl_simple',
  title: 'SDXL Simple',
  status: 'approved',
  ...overrides
})

describe('mapHubWorkflowIndexEntryToTemplate', () => {
  it('maps template metadata used by the selector dialog', () => {
    const result = mapHubWorkflowIndexEntryToTemplate(
      makeEntry({
        description: 'Starter SDXL workflow',
        tags: ['Image', 'Text to Image'],
        models: ['SDXL'],
        requiresCustomNodes: ['comfy-custom-pack'],
        thumbnailVariant: 'compareSlider',
        mediaType: 'image',
        mediaSubtype: 'webp',
        size: 1024,
        vram: 2048,
        openSource: true,
        tutorialUrl: 'https://docs.comfy.org/tutorials/sdxl',
        logos: [
          {
            provider: 'OpenAI',
            label: 'OpenAI',
            opacity: 0.7
          }
        ],
        date: '2026-04-14',
        includeOnDistributions: ['cloud', 'desktop', 'unsupported'],
        thumbnailUrl: 'https://cdn.example.com/thumb.webp',
        thumbnailComparisonUrl: 'https://cdn.example.com/compare.webp',
        shareId: 'share-123',
        usage: 42,
        searchRank: 7,
        isEssential: true,
        useCase: 'Image generation',
        license: 'MIT'
      })
    )

    expect(result).toEqual({
      name: 'sdxl_simple',
      title: 'SDXL Simple',
      description: 'Starter SDXL workflow',
      mediaType: 'image',
      mediaSubtype: 'webp',
      thumbnailVariant: 'compareSlider',
      isEssential: true,
      shareId: 'share-123',
      tags: ['Image', 'Text to Image'],
      models: ['SDXL'],
      date: '2026-04-14',
      useCase: 'Image generation',
      license: 'MIT',
      vram: 2048,
      size: 1024,
      openSource: true,
      thumbnailUrl: 'https://cdn.example.com/thumb.webp',
      thumbnailComparisonUrl: 'https://cdn.example.com/compare.webp',
      requiresCustomNodes: ['comfy-custom-pack'],
      searchRank: 7,
      usage: 42,
      includeOnDistributions: ['cloud', 'desktop'],
      logos: [{ provider: 'OpenAI', label: 'OpenAI', opacity: 0.7 }],
      tutorialUrl: 'https://docs.comfy.org/tutorials/sdxl'
    })
  })

  it('infers video thumbnails from preview URLs', () => {
    const result = mapHubWorkflowIndexEntryToTemplate(
      makeEntry({
        mediaType: 'image',
        mediaSubtype: 'webp',
        thumbnailUrl: 'https://cdn.example.com/preview.mp4'
      })
    )

    expect(result.mediaType).toBe('video')
    expect(result.mediaSubtype).toBe('mp4')
  })

  it('drops invalid logo and distribution values', () => {
    const result = mapHubWorkflowIndexEntryToTemplate(
      makeEntry({
        logos: [
          { provider: ['OpenAI', 'Runway'], gap: -4 },
          { provider: 123 }
        ] as Array<Record<string, unknown>>,
        includeOnDistributions: ['local', 'desktop', 'invalid']
      })
    )

    expect(result.logos).toEqual([{ provider: ['OpenAI', 'Runway'], gap: -4 }])
    expect(result.includeOnDistributions).toEqual(['local', 'desktop'])
  })
})

describe('mapHubWorkflowIndexToCategories', () => {
  it('groups entries by section and sectionGroup into WorkflowTemplates', () => {
    const result = mapHubWorkflowIndexToCategories([
      makeEntry({
        name: 'img-template',
        title: 'Image Template',
        section: 'Image',
        sectionGroup: 'GENERATION TYPE'
      }),
      makeEntry({
        name: 'vid-template',
        title: 'Video Template',
        section: 'Video',
        sectionGroup: 'GENERATION TYPE'
      }),
      makeEntry({
        name: 'img-template-2',
        title: 'Image Template 2',
        section: 'Image',
        sectionGroup: 'GENERATION TYPE'
      })
    ])

    expect(result).toHaveLength(2)

    const imageCategory = result.find((c) => c.title === 'Image')!
    expect(imageCategory.moduleName).toBe('default')
    expect(imageCategory.category).toBe('GENERATION TYPE')
    expect(imageCategory.templates.map((t) => t.name)).toEqual([
      'img-template',
      'img-template-2'
    ])

    const videoCategory = result.find((c) => c.title === 'Video')!
    expect(videoCategory.moduleName).toBe('default')
    expect(videoCategory.category).toBe('GENERATION TYPE')
    expect(videoCategory.templates.map((t) => t.name)).toEqual(['vid-template'])
  })

  it('falls back to a single "All" category when entries lack section metadata', () => {
    const result = mapHubWorkflowIndexToCategories([
      makeEntry({ name: 'template-a', title: 'Template A' }),
      makeEntry({ name: 'template-b', title: 'Template B' })
    ])

    expect(result).toHaveLength(1)
    expect(result[0].moduleName).toBe('default')
    expect(result[0].title).toBe('All')
    expect(result[0].templates.map((t) => t.name)).toEqual([
      'template-a',
      'template-b'
    ])
  })

  it('propagates isEssential from entries to categories', () => {
    const result = mapHubWorkflowIndexToCategories([
      makeEntry({
        name: 'essential-1',
        section: 'Getting Started',
        sectionGroup: 'GENERATION TYPE',
        isEssential: true
      }),
      makeEntry({
        name: 'non-essential',
        section: 'Getting Started',
        sectionGroup: 'GENERATION TYPE',
        isEssential: false
      })
    ])

    const category = result.find((c) => c.title === 'Getting Started')!
    expect(category.isEssential).toBe(true)
  })
})
