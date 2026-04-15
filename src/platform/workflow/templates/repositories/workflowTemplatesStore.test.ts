import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useWorkflowTemplatesStore } from './workflowTemplatesStore'

const distributionState = vi.hoisted(() => ({
  isCloud: true
}))

const apiMocks = vi.hoisted(() => ({
  getWorkflowTemplates: vi.fn(),
  getHubWorkflowTemplateIndex: vi.fn(),
  getCoreWorkflowTemplates: vi.fn(),
  fileURL: vi.fn((path: string) => path)
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distributionState.isCloud
  }
}))

vi.mock('@/scripts/api', () => ({
  api: apiMocks
}))

vi.mock('@/i18n', () => ({
  i18n: {
    global: {
      locale: ref('en')
    }
  },
  st: (_key: string, fallback: string) => fallback
}))

describe('workflowTemplatesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    distributionState.isCloud = true

    apiMocks.getWorkflowTemplates.mockResolvedValue({})
    apiMocks.getHubWorkflowTemplateIndex.mockResolvedValue([
      {
        name: 'starter-template',
        title: 'Starter Template',
        status: 'approved',
        description: 'A cloud starter workflow',
        shareId: 'share-123',
        usage: 10,
        searchRank: 5,
        isEssential: true,
        section: 'Use Cases',
        sectionGroup: 'GENERATION TYPE',
        thumbnailUrl: 'https://cdn.example.com/thumb.webp'
      },
      {
        name: 'image-gen',
        title: 'Image Generation',
        status: 'approved',
        description: 'Image generation workflow',
        shareId: 'share-456',
        section: 'Image',
        sectionGroup: 'GENERATION TYPE',
        thumbnailUrl: 'https://cdn.example.com/img.webp'
      },
      {
        name: 'video-gen',
        title: 'Video Generation',
        status: 'approved',
        description: 'Video generation workflow',
        shareId: 'share-789',
        section: 'Video',
        sectionGroup: 'GENERATION TYPE',
        thumbnailUrl: 'https://cdn.example.com/vid.webp'
      }
    ])

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        headers: {
          get: vi.fn(() => 'application/json')
        },
        json: vi.fn().mockResolvedValue({})
      })
    )
  })

  it('loads cloud templates from the hub index and resolves share ids', async () => {
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    const template = store.getTemplateByShareId('share-123')
    expect(template?.name).toBe('starter-template')
    expect(template?.shareId).toBe('share-123')
    expect(store.knownTemplateNames.has('starter-template')).toBe(true)
  })

  it('builds nav groups from section metadata on cloud templates', async () => {
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    // Essential templates appear under Basics
    const basicsNav = store.navGroupedTemplates.find(
      (item) => 'id' in item && item.id === 'basics-use-cases'
    )
    expect(basicsNav).toBeDefined()
    expect(
      store.filterTemplatesByCategory('basics-use-cases').map((t) => t.name)
    ).toEqual(['starter-template'])

    // Non-essential templates grouped under GENERATION TYPE
    const genTypeGroup = store.navGroupedTemplates.find(
      (item) => 'title' in item && item.title === 'Generation Type'
    )
    expect(genTypeGroup).toBeDefined()
    expect('items' in genTypeGroup!).toBe(true)

    const groupItems = (genTypeGroup as { items: Array<{ id: string }> }).items
    expect(groupItems.map((i) => i.id)).toEqual(
      expect.arrayContaining(['generation-type-image', 'generation-type-video'])
    )
  })

  it('filters templates by section-based category id', async () => {
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    // Access navGroupedTemplates to populate categoryFilters
    expect(store.navGroupedTemplates.length).toBeGreaterThan(0)

    const imageTemplates = store.filterTemplatesByCategory(
      'generation-type-image'
    )
    expect(imageTemplates.map((t) => t.name)).toEqual(['image-gen'])

    const videoTemplates = store.filterTemplatesByCategory(
      'generation-type-video'
    )
    expect(videoTemplates.map((t) => t.name)).toEqual(['video-gen'])
  })
})
