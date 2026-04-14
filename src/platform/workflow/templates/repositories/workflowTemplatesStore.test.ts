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
        thumbnailUrl: 'https://cdn.example.com/thumb.webp'
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

  it('creates a generic getting started nav item for essential cloud templates', async () => {
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    const navItem = store.navGroupedTemplates.find(
      (item) => 'id' in item && item.id === 'basics-getting-started'
    )

    expect(navItem).toEqual({
      id: 'basics-getting-started',
      label: 'Getting Started',
      icon: expect.any(String)
    })
    expect(
      store
        .filterTemplatesByCategory('basics-getting-started')
        .map((template) => template.name)
    ).toEqual(['starter-template'])
  })
})
