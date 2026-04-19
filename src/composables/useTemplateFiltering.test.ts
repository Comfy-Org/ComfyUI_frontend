import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { IFuseOptions } from 'fuse.js'

import type { TemplateInfo } from '@/platform/workflow/templates/types/template'
import { TemplateIncludeOnDistributionEnum } from '@/platform/workflow/templates/types/template'
import { useTemplateFiltering } from '@/composables/useTemplateFiltering'

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

const mockGetFuseOptions = vi.hoisted(() => vi.fn())
vi.mock('@/scripts/api', () => ({
  api: {
    getFuseOptions: mockGetFuseOptions
  }
}))

describe('useTemplateFiltering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockGetFuseOptions.mockResolvedValue(null)
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

  describe('loadFuseOptions', () => {
    it('updates fuseOptions when getFuseOptions returns valid options', async () => {
      const templates = ref<TemplateInfo[]>([
        {
          name: 'test-template',
          description: 'Test template',
          mediaType: 'image',
          mediaSubtype: 'png'
        }
      ])

      const customFuseOptions: IFuseOptions<TemplateInfo> = {
        keys: [
          { name: 'name', weight: 0.5 },
          { name: 'description', weight: 0.5 }
        ],
        threshold: 0.4,
        includeScore: true
      }

      mockGetFuseOptions.mockResolvedValueOnce(customFuseOptions)

      const { loadFuseOptions, filteredTemplates } =
        useTemplateFiltering(templates)

      await loadFuseOptions()

      expect(mockGetFuseOptions).toHaveBeenCalledTimes(1)
      expect(filteredTemplates.value).toBeDefined()
    })

    it('does not update fuseOptions when getFuseOptions returns null', async () => {
      const templates = ref<TemplateInfo[]>([
        {
          name: 'test-template',
          description: 'Test template',
          mediaType: 'image',
          mediaSubtype: 'png'
        }
      ])

      mockGetFuseOptions.mockResolvedValueOnce(null)

      const { loadFuseOptions, filteredTemplates } =
        useTemplateFiltering(templates)

      const initialResults = filteredTemplates.value

      await loadFuseOptions()

      expect(mockGetFuseOptions).toHaveBeenCalledTimes(1)
      expect(filteredTemplates.value).toEqual(initialResults)
    })

    it('handles errors when getFuseOptions fails', async () => {
      const templates = ref<TemplateInfo[]>([
        {
          name: 'test-template',
          description: 'Test template',
          mediaType: 'image',
          mediaSubtype: 'png'
        }
      ])

      mockGetFuseOptions.mockRejectedValueOnce(new Error('Network error'))

      const { loadFuseOptions, filteredTemplates } =
        useTemplateFiltering(templates)

      const initialResults = filteredTemplates.value

      await expect(loadFuseOptions()).rejects.toThrow('Network error')
      expect(filteredTemplates.value).toEqual(initialResults)
    })

    it('recreates Fuse instance when fuseOptions change', async () => {
      const templates = ref<TemplateInfo[]>([
        {
          name: 'searchable-template',
          description: 'This is a searchable template',
          mediaType: 'image',
          mediaSubtype: 'png'
        },
        {
          name: 'another-template',
          description: 'Another template',
          mediaType: 'image',
          mediaSubtype: 'png'
        }
      ])

      const { loadFuseOptions, searchQuery, filteredTemplates } =
        useTemplateFiltering(templates)

      const customFuseOptions = {
        keys: [{ name: 'name', weight: 1.0 }],
        threshold: 0.2,
        includeScore: true,
        includeMatches: true
      }

      mockGetFuseOptions.mockResolvedValueOnce(customFuseOptions)

      await loadFuseOptions()
      await nextTick()

      searchQuery.value = 'searchable'
      await nextTick()

      expect(filteredTemplates.value.length).toBeGreaterThan(0)
      expect(mockGetFuseOptions).toHaveBeenCalledTimes(1)
    })
  })

  describe('Scope-aware filtering', () => {
    it('filters out inactive models when scope changes', () => {
      // Start with image templates only
      const templates = ref<TemplateInfo[]>([
        {
          name: 'flux-template',
          description: 'Flux model template',
          models: ['Flux', 'Dall-E'],
          mediaType: 'image',
          mediaSubtype: 'png'
        }
      ])

      const currentScope = ref('image')

      const {
        selectedModels,
        activeModels,
        inactiveModels,
        filteredTemplates
      } = useTemplateFiltering(templates, currentScope)

      // Select models from both image and video domains
      selectedModels.value = ['Flux', 'Luma']

      // In image scope, only Flux should be active because Luma doesn't exist in any image template
      expect(activeModels.value).toEqual(['Flux'])
      expect(inactiveModels.value).toEqual(['Luma'])
      expect(filteredTemplates.value).toHaveLength(1)
      expect(filteredTemplates.value[0].name).toBe('flux-template')

      // Switch to video scope with only video templates
      currentScope.value = 'video'
      templates.value = [
        {
          name: 'luma-template',
          description: 'Luma video template',
          models: ['Luma', 'Runway'],
          mediaType: 'video',
          mediaSubtype: 'mp4'
        }
      ]

      // In video scope, only Luma should be active because Flux doesn't exist in any video template
      expect(activeModels.value).toEqual(['Luma'])
      expect(inactiveModels.value).toEqual(['Flux'])
      expect(filteredTemplates.value).toHaveLength(1)
      expect(filteredTemplates.value[0].name).toBe('luma-template')
    })

    it('maintains selected filters across scope changes', () => {
      const templates = ref<TemplateInfo[]>([
        {
          name: 'template1',
          description: 'Template 1',
          models: ['Model1'],
          mediaType: 'image',
          mediaSubtype: 'png'
        }
      ])

      const currentScope = ref('image')
      const { selectedModels, activeModels } = useTemplateFiltering(
        templates,
        currentScope
      )

      // Select a model
      selectedModels.value = ['Model1', 'Model2']

      // Model1 is active, Model2 is not available
      expect(activeModels.value).toEqual(['Model1'])
      expect(selectedModels.value).toEqual(['Model1', 'Model2'])

      // Change scope - selected models should persist
      currentScope.value = 'video'
      templates.value = []

      expect(selectedModels.value).toEqual(['Model1', 'Model2'])
      expect(activeModels.value).toEqual([])
    })
  })

  describe('Distribution filtering', () => {
    const cloudTemplate: TemplateInfo = {
      name: 'cloud-only',
      description: 'Cloud template',
      mediaType: 'image',
      mediaSubtype: 'png',
      models: ['Wan 2.2'],
      includeOnDistributions: [TemplateIncludeOnDistributionEnum.Cloud]
    }

    const desktopTemplate: TemplateInfo = {
      name: 'desktop-only',
      description: 'Desktop template',
      mediaType: 'image',
      mediaSubtype: 'png',
      models: ['Wan 2.2'],
      includeOnDistributions: [TemplateIncludeOnDistributionEnum.Desktop]
    }

    const universalTemplate: TemplateInfo = {
      name: 'universal',
      description: 'Universal template',
      mediaType: 'image',
      mediaSubtype: 'png',
      models: ['Wan 2.2']
    }

    const multiDistTemplate: TemplateInfo = {
      name: 'multi-dist',
      description: 'Multi-distribution',
      mediaType: 'image',
      mediaSubtype: 'png',
      includeOnDistributions: [
        TemplateIncludeOnDistributionEnum.Cloud,
        TemplateIncludeOnDistributionEnum.Desktop
      ]
    }

    it('excludes templates not matching the distribution filter', () => {
      const templates = ref([cloudTemplate, desktopTemplate, universalTemplate])
      const distributionFilter = ref([TemplateIncludeOnDistributionEnum.Cloud])

      const { filteredTemplates, filteredCount, totalCount } =
        useTemplateFiltering(templates, undefined, distributionFilter)

      expect(filteredTemplates.value.map((t) => t.name)).toEqual([
        'cloud-only',
        'universal'
      ])
      expect(filteredCount.value).toBe(2)
      expect(totalCount.value).toBe(2)
    })

    it('keeps filteredCount and totalCount consistent with model + distribution filters', () => {
      const fluxCloudTemplate: TemplateInfo = {
        name: 'flux-cloud',
        description: 'Flux on cloud',
        mediaType: 'image',
        mediaSubtype: 'png',
        models: ['Flux'],
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Cloud]
      }

      const templates = ref([cloudTemplate, desktopTemplate, fluxCloudTemplate])
      const distributionFilter = ref([TemplateIncludeOnDistributionEnum.Cloud])

      const { selectedModels, filteredTemplates, filteredCount, totalCount } =
        useTemplateFiltering(templates, undefined, distributionFilter)

      expect(totalCount.value).toBe(2)

      selectedModels.value = ['Wan 2.2']

      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('cloud-only')
    })

    it('shows all templates when no distribution filter is provided', () => {
      const templates = ref([cloudTemplate, desktopTemplate])

      const { filteredCount, totalCount } = useTemplateFiltering(templates)

      expect(filteredCount.value).toBe(2)
      expect(totalCount.value).toBe(2)
    })

    it('shows all templates when distribution filter is an empty array', () => {
      const templates = ref([cloudTemplate, desktopTemplate])
      const distributionFilter = ref<TemplateIncludeOnDistributionEnum[]>([])

      const { filteredCount, totalCount } = useTemplateFiltering(
        templates,
        undefined,
        distributionFilter
      )

      expect(filteredCount.value).toBe(2)
      expect(totalCount.value).toBe(2)
    })

    it('includes templates with multiple distributions when any match', () => {
      const templates = ref([multiDistTemplate])
      const distributionFilter = ref([TemplateIncludeOnDistributionEnum.Cloud])

      const { filteredCount } = useTemplateFiltering(
        templates,
        undefined,
        distributionFilter
      )

      expect(filteredCount.value).toBe(1)
    })

    it('excludes templates with multiple distributions when none match', () => {
      const templates = ref([multiDistTemplate])
      const distributionFilter = ref([TemplateIncludeOnDistributionEnum.Local])

      const { filteredCount } = useTemplateFiltering(
        templates,
        undefined,
        distributionFilter
      )

      expect(filteredCount.value).toBe(0)
    })

    it('reacts to distribution filter changes', () => {
      const templates = ref([cloudTemplate, desktopTemplate, universalTemplate])
      const distributionFilter = ref([TemplateIncludeOnDistributionEnum.Cloud])

      const { filteredCount, totalCount } = useTemplateFiltering(
        templates,
        undefined,
        distributionFilter
      )

      expect(filteredCount.value).toBe(2)
      expect(totalCount.value).toBe(2)

      distributionFilter.value = [TemplateIncludeOnDistributionEnum.Desktop]

      expect(filteredCount.value).toBe(2)
      expect(totalCount.value).toBe(2)
    })

    it('excludes desktop-only models and use cases from filter options on cloud', () => {
      const cloudFlux: TemplateInfo = {
        name: 'cloud-flux',
        description: 'Flux on cloud',
        mediaType: 'image',
        mediaSubtype: 'png',
        models: ['Flux'],
        tags: ['Image Gen'],
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Cloud]
      }
      const desktopSD: TemplateInfo = {
        name: 'desktop-sd',
        description: 'SD on desktop',
        mediaType: 'image',
        mediaSubtype: 'png',
        models: ['SD 1.5'],
        tags: ['Inpainting'],
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Desktop]
      }

      const templates = ref([cloudFlux, desktopSD])
      const distributionFilter = ref([TemplateIncludeOnDistributionEnum.Cloud])

      const { availableModels, availableUseCases } = useTemplateFiltering(
        templates,
        undefined,
        distributionFilter
      )

      expect(availableModels.value).toEqual(['Flux'])
      expect(availableModels.value).not.toContain('SD 1.5')
      expect(availableUseCases.value).toEqual(['Image Gen'])
      expect(availableUseCases.value).not.toContain('Inpainting')
    })

    it('distribution filter composes with search filter', async () => {
      vi.useFakeTimers()

      const searchableTemplate: TemplateInfo = {
        name: 'searchable-cloud',
        description: 'A very unique searchable description',
        mediaType: 'image',
        mediaSubtype: 'png',
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Cloud]
      }
      const searchableDesktopTemplate: TemplateInfo = {
        name: 'searchable-desktop',
        description: 'A very unique searchable description',
        mediaType: 'image',
        mediaSubtype: 'png',
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Desktop]
      }

      const templates = ref([searchableTemplate, searchableDesktopTemplate])
      const distributionFilter = ref([TemplateIncludeOnDistributionEnum.Cloud])

      const { searchQuery, filteredTemplates, filteredCount } =
        useTemplateFiltering(templates, undefined, distributionFilter)

      searchQuery.value = 'unique searchable'
      await nextTick()
      await vi.runOnlyPendingTimersAsync()
      await nextTick()

      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('searchable-cloud')
    })

    it('distribution filter composes with use case filter', () => {
      const taggedCloudTemplate: TemplateInfo = {
        name: 'tagged-cloud',
        description: 'Tagged cloud',
        mediaType: 'image',
        mediaSubtype: 'png',
        tags: ['Video'],
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Cloud]
      }
      const taggedDesktopTemplate: TemplateInfo = {
        name: 'tagged-desktop',
        description: 'Tagged desktop',
        mediaType: 'image',
        mediaSubtype: 'png',
        tags: ['Video'],
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Desktop]
      }

      const templates = ref([taggedCloudTemplate, taggedDesktopTemplate])
      const distributionFilter = ref([TemplateIncludeOnDistributionEnum.Cloud])

      const { selectedUseCases, filteredTemplates, filteredCount } =
        useTemplateFiltering(templates, undefined, distributionFilter)

      selectedUseCases.value = ['Video']

      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('tagged-cloud')
    })

    it('distribution filter composes with runsOn filter', () => {
      const apiCloudTemplate: TemplateInfo = {
        name: 'api-cloud',
        description: 'API cloud',
        mediaType: 'image',
        mediaSubtype: 'png',
        openSource: false,
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Cloud]
      }
      const apiDesktopTemplate: TemplateInfo = {
        name: 'api-desktop',
        description: 'API desktop',
        mediaType: 'image',
        mediaSubtype: 'png',
        openSource: false,
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Desktop]
      }

      const templates = ref([apiCloudTemplate, apiDesktopTemplate])
      const distributionFilter = ref([TemplateIncludeOnDistributionEnum.Cloud])

      const { selectedRunsOn, filteredTemplates, filteredCount } =
        useTemplateFiltering(templates, undefined, distributionFilter)

      selectedRunsOn.value = ['External or Remote API']

      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('api-cloud')
    })

    it('stale persisted model selection does not cause zero results', () => {
      const cloudFlux: TemplateInfo = {
        name: 'cloud-flux',
        description: 'Flux on cloud',
        mediaType: 'image',
        mediaSubtype: 'png',
        models: ['Flux'],
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Cloud]
      }

      const templates = ref([cloudFlux])
      const distributionFilter = ref([TemplateIncludeOnDistributionEnum.Cloud])

      const {
        selectedModels,
        activeModels,
        inactiveModels,
        filteredTemplates,
        filteredCount
      } = useTemplateFiltering(templates, undefined, distributionFilter)

      selectedModels.value = ['SD 1.5']

      expect(activeModels.value).toEqual([])
      expect(inactiveModels.value).toEqual(['SD 1.5'])
      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('cloud-flux')
    })

    it('mac distribution matches templates with mac includeOnDistributions', () => {
      const macTemplate: TemplateInfo = {
        name: 'mac-template',
        description: 'Mac only',
        mediaType: 'image',
        mediaSubtype: 'png',
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Mac]
      }

      const templates = ref([macTemplate, cloudTemplate])
      const distributionFilter = ref([
        TemplateIncludeOnDistributionEnum.Desktop,
        TemplateIncludeOnDistributionEnum.Mac
      ])

      const { filteredTemplates, filteredCount } = useTemplateFiltering(
        templates,
        undefined,
        distributionFilter
      )

      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('mac-template')
    })
  })
})
