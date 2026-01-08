import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

const defaultSettingStore = {
  get: vi.fn((key: string) => {
    switch (key) {
      case 'Comfy.Templates.SelectedModels':
      case 'Comfy.Templates.SelectedUseCases':
      case 'Comfy.Templates.SelectedRunsOn':
        return []
      case 'Comfy.Templates.SortBy':
        return 'newest'
      default:
        return undefined
    }
  }),
  set: vi.fn().mockResolvedValue(undefined)
}

const defaultRankingStore = {
  computeDefaultScore: vi.fn(() => 0),
  computePopularScore: vi.fn(() => 0),
  getUsageScore: vi.fn(() => 0),
  computeFreshness: vi.fn(() => 0.5),
  isLoaded: { value: false }
}

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => defaultSettingStore)
}))

vi.mock('@/stores/templateRankingStore', () => ({
  useTemplateRankingStore: vi.fn(() => defaultRankingStore)
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackTemplateFilterChanged: vi.fn()
  }))
}))

const { useTemplateFiltering } =
  await import('@/composables/useTemplateFiltering')

describe('useTemplateFiltering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sorts templates by VRAM from low to high and pushes missing values last', () => {
    const gb = (value: number) => value * 1024 ** 3

    const templates = ref<TemplateInfo[]>([
      {
        name: 'missing-vram',
        description: 'no vram value',
        mediaType: 'image',
        mediaSubtype: 'png'
      },
      {
        name: 'highest-vram',
        description: 'high usage',
        mediaType: 'image',
        mediaSubtype: 'png',
        vram: gb(12)
      },
      {
        name: 'mid-vram',
        description: 'medium usage',
        mediaType: 'image',
        mediaSubtype: 'png',
        vram: gb(7.5)
      },
      {
        name: 'low-vram',
        description: 'low usage',
        mediaType: 'image',
        mediaSubtype: 'png',
        vram: gb(5)
      },
      {
        name: 'zero-vram',
        description: 'unknown usage',
        mediaType: 'image',
        mediaSubtype: 'png',
        vram: 0
      }
    ])

    const { sortBy, filteredTemplates } = useTemplateFiltering(templates)

    sortBy.value = 'vram-low-to-high'

    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'low-vram',
      'mid-vram',
      'highest-vram',
      'missing-vram',
      'zero-vram'
    ])
  })

  it('filters by search text, models, tags, and license with debounce handling', async () => {
    vi.useFakeTimers()

    const templates = ref<TemplateInfo[]>([
      {
        name: 'api-template',
        description: 'Enterprise API workflow for video',
        mediaType: 'image',
        mediaSubtype: 'png',
        tags: ['API', 'Video'],
        models: ['Flux'],
        date: '2024-06-01',
        vram: 15 * 1024 ** 3,
        openSource: false
      },
      {
        name: 'portrait-flow',
        description: 'Portrait template tuned for SDXL',
        mediaType: 'image',
        mediaSubtype: 'png',
        tags: ['Portrait'],
        models: ['SDXL'],
        date: '2024-05-15',
        vram: 10 * 1024 ** 3
      },
      {
        name: 'landscape-lite',
        description: 'Lightweight landscape generator',
        mediaType: 'image',
        mediaSubtype: 'png',
        tags: ['Landscape'],
        models: ['SDXL', 'Flux'],
        date: '2024-04-20'
      }
    ])

    const {
      searchQuery,
      selectedModels,
      selectedUseCases,
      selectedRunsOn,
      filteredTemplates,
      availableModels,
      availableUseCases,
      availableRunsOn,
      filteredCount,
      totalCount,
      removeUseCaseFilter,
      resetFilters
    } = useTemplateFiltering(templates)

    expect(totalCount.value).toBe(3)
    expect(availableModels.value).toEqual(['Flux', 'SDXL'])
    expect(availableUseCases.value).toEqual([
      'API',
      'Landscape',
      'Portrait',
      'Video'
    ])
    expect(availableRunsOn.value).toEqual(['ComfyUI', 'External or Remote API'])

    searchQuery.value = 'enterprise'
    await nextTick()
    await vi.runOnlyPendingTimersAsync()
    await nextTick()
    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'api-template'
    ])

    selectedRunsOn.value = ['External or Remote API']
    await nextTick()
    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'api-template'
    ])

    selectedModels.value = ['Flux']
    await nextTick()
    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'api-template'
    ])

    selectedUseCases.value = ['Video']
    await nextTick()
    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'api-template'
    ])
    expect(filteredCount.value).toBe(1)

    removeUseCaseFilter('Video')
    await nextTick()
    expect(selectedUseCases.value).toHaveLength(0)

    resetFilters()
    await nextTick()
    await vi.runOnlyPendingTimersAsync()
    await nextTick()
    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'api-template',
      'portrait-flow',
      'landscape-lite'
    ])
  })

  it('supports alphabetical, newest, and size-based sorting options', async () => {
    const templates = ref<TemplateInfo[]>([
      {
        name: 'zeta-extended',
        description: 'older template',
        mediaType: 'image',
        mediaSubtype: 'png',
        date: '2024-01-01',
        size: 300
      },
      {
        name: 'alpha-starter',
        description: 'new template',
        mediaType: 'image',
        mediaSubtype: 'png',
        date: '2024-07-01',
        size: 100
      },
      {
        name: 'beta-pro',
        description: 'mid template',
        mediaType: 'image',
        mediaSubtype: 'png',
        date: '2024-05-01',
        size: 200
      }
    ])

    const { sortBy, filteredTemplates } = useTemplateFiltering(templates)

    // default is 'newest'
    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'alpha-starter',
      'beta-pro',
      'zeta-extended'
    ])

    sortBy.value = 'alphabetical'
    await nextTick()
    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'alpha-starter',
      'beta-pro',
      'zeta-extended'
    ])

    sortBy.value = 'model-size-low-to-high'
    await nextTick()
    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'alpha-starter',
      'beta-pro',
      'zeta-extended'
    ])

    sortBy.value = 'default'
    await nextTick()
    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'zeta-extended',
      'alpha-starter',
      'beta-pro'
    ])
  })

  it('incorporates search relevance into recommended sorting', async () => {
    vi.useFakeTimers()

    const templates = ref<TemplateInfo[]>([
      {
        name: 'wan-video-exact',
        title: 'Wan Video Template',
        description: 'A template with Wan in title',
        mediaType: 'image',
        mediaSubtype: 'png',
        date: '2024-01-01',
        usage: 10
      },
      {
        name: 'qwen-image-partial',
        title: 'Qwen Image Editor',
        description: 'A template that contains w, a, n scattered',
        mediaType: 'image',
        mediaSubtype: 'png',
        date: '2024-01-01',
        usage: 1000 // Higher usage but worse search match
      },
      {
        name: 'wan-text-exact',
        title: 'Wan2.5: Text to Image',
        description: 'Another exact match for Wan',
        mediaType: 'image',
        mediaSubtype: 'png',
        date: '2024-01-01',
        usage: 50
      }
    ])

    const { searchQuery, sortBy, filteredTemplates } =
      useTemplateFiltering(templates)

    // Search for "Wan"
    searchQuery.value = 'Wan'
    sortBy.value = 'recommended'
    await nextTick()
    await vi.runOnlyPendingTimersAsync()
    await nextTick()

    // Templates with "Wan" in title should rank higher than Qwen despite lower usage
    // because search relevance is now factored into the recommended sort
    const results = filteredTemplates.value.map((t) => t.name)

    // Verify exact matches appear (Qwen might be filtered out by threshold)
    expect(results).toContain('wan-video-exact')
    expect(results).toContain('wan-text-exact')

    // If Qwen appears, it should be ranked lower than exact matches
    if (results.includes('qwen-image-partial')) {
      const wanIndex = results.indexOf('wan-video-exact')
      const qwenIndex = results.indexOf('qwen-image-partial')
      expect(wanIndex).toBeLessThan(qwenIndex)
    }

    vi.useRealTimers()
  })

  it('preserves Fuse search order when using default sort', async () => {
    vi.useFakeTimers()

    const templates = ref<TemplateInfo[]>([
      {
        name: 'portrait-basic',
        title: 'Basic Portrait',
        description: 'A basic template',
        mediaType: 'image',
        mediaSubtype: 'png'
      },
      {
        name: 'portrait-pro',
        title: 'Portrait Pro Edition',
        description: 'Advanced portrait features',
        mediaType: 'image',
        mediaSubtype: 'png'
      },
      {
        name: 'landscape-view',
        title: 'Landscape Generator',
        description: 'Generate landscapes',
        mediaType: 'image',
        mediaSubtype: 'png'
      }
    ])

    const { searchQuery, sortBy, filteredTemplates } =
      useTemplateFiltering(templates)

    searchQuery.value = 'Portrait Pro'
    sortBy.value = 'default'
    await nextTick()
    await vi.runOnlyPendingTimersAsync()
    await nextTick()

    const results = filteredTemplates.value.map((t) => t.name)

    // With default sort, Fuse's relevance ordering is preserved
    // "Portrait Pro Edition" should be first as it's the best match
    expect(results[0]).toBe('portrait-pro')
  })
})
