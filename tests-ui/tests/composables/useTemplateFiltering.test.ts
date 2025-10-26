import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useTemplateFiltering } from '@/composables/useTemplateFiltering'
import type { TemplateInfo } from '@/platform/workflow/templates/types/template'

describe('useTemplateFiltering', () => {
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
        vram: 15 * 1024 ** 3
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
      selectedLicenses,
      filteredTemplates,
      availableModels,
      availableUseCases,
      availableLicenses,
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
    expect(availableLicenses.value).toEqual([
      'Open Source',
      'Closed Source (API Nodes)'
    ])

    searchQuery.value = 'enterprise'
    await nextTick()
    await vi.runOnlyPendingTimersAsync()
    await nextTick()
    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'api-template'
    ])

    selectedLicenses.value = ['Closed Source (API Nodes)']
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
})
