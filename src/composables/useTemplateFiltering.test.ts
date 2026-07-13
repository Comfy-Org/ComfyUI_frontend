import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

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
  computeDefaultScore: vi.fn(
    (_date?: string, _rank?: number, usage: number = 0) => usage
  ),
  computeFreshness: vi.fn(() => 0.5),
  largestUsageScore: 0
}

const mockSystemStatsStore = {
  systemStats: {
    system: {
      os: 'linux'
    }
  }
}

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => defaultSettingStore)
}))

vi.mock('@/stores/templateRankingStore', () => ({
  useTemplateRankingStore: vi.fn(() => defaultRankingStore)
}))

vi.mock('@/stores/systemStatsStore', () => ({
  useSystemStatsStore: vi.fn(() => mockSystemStatsStore)
}))

const trackTemplateFilterChanged = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackTemplateFilterChanged,
    trackSearchQuery: vi.fn()
  }))
}))

vi.mock('@/platform/telemetry/searchQuery/useSearchQueryTracking', () => ({
  useSearchQueryTracking: vi.fn()
}))

describe('useTemplateFiltering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')
    mockSystemStatsStore.systemStats.system.os = 'linux'
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
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

  const usageRankedTemplates = () =>
    ref<TemplateInfo[]>([
      {
        name: 'low',
        title: 'Low',
        description: '',
        mediaType: 'image',
        mediaSubtype: 'png',
        usage: 10
      },
      {
        name: 'high',
        title: 'High',
        description: '',
        mediaType: 'image',
        mediaSubtype: 'png',
        usage: 900
      }
    ])

  it('ranks "recommended" via computeDefaultScore', async () => {
    const { sortBy, filteredTemplates } = useTemplateFiltering(
      usageRankedTemplates()
    )

    sortBy.value = 'recommended'
    await nextTick()

    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'high',
      'low'
    ])
    expect(defaultRankingStore.computeDefaultScore).toHaveBeenCalled()
  })

  it('ranks "popular" by raw usage without the recommended score', async () => {
    const { sortBy, filteredTemplates } = useTemplateFiltering(
      usageRankedTemplates()
    )

    sortBy.value = 'popular'
    await nextTick()

    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'high',
      'low'
    ])
    expect(defaultRankingStore.computeDefaultScore).not.toHaveBeenCalled()
  })

  it('filters to ComfyUI templates via the Runs On filter', async () => {
    const templates = ref<TemplateInfo[]>([
      {
        name: 'open',
        title: 'Open',
        description: '',
        mediaType: 'image',
        mediaSubtype: 'png',
        openSource: true
      },
      {
        name: 'partner',
        title: 'Partner',
        description: '',
        mediaType: 'image',
        mediaSubtype: 'png',
        openSource: false
      }
    ])

    const { selectedRunsOn, filteredTemplates } =
      useTemplateFiltering(templates)
    selectedRunsOn.value = ['ComfyUI']
    await nextTick()

    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'open'
    ])
  })

  it('sorts alphabetically by the localized title shown on the card', async () => {
    const templates = ref<TemplateInfo[]>([
      {
        name: 'z-raw',
        title: 'Apple', // raw title would sort first
        localizedTitle: 'Zebra', // but the card shows this
        description: '',
        mediaType: 'image',
        mediaSubtype: 'png'
      },
      {
        name: 'a-raw',
        title: 'Zulu',
        localizedTitle: 'Ant',
        description: '',
        mediaType: 'image',
        mediaSubtype: 'png'
      }
    ])

    const { sortBy, filteredTemplates } = useTemplateFiltering(templates)
    sortBy.value = 'alphabetical'
    await nextTick()

    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'a-raw', // Ant
      'z-raw' // Zebra
    ])
  })

  it('A-Z trims whitespace, groups numbers after letters, and orders them naturally', async () => {
    const make = (name: string, title: string): TemplateInfo => ({
      name,
      title,
      description: '',
      mediaType: 'image',
      mediaSubtype: 'png'
    })
    const templates = ref<TemplateInfo[]>([
      make('ten', '1.10 Model'),
      make('two', '1.2 Model'),
      make('spaced', ' Apple'), // leading space must not jump to the top
      make('zebra', 'Zebra')
    ])

    const { sortBy, filteredTemplates } = useTemplateFiltering(templates)
    sortBy.value = 'alphabetical'
    await nextTick()

    expect(filteredTemplates.value.map((template) => template.name)).toEqual([
      'spaced', // " Apple" trimmed → sorts as a letter, first
      'zebra',
      'two', // numbers grouped after letters; 1.2 before 1.10 (numeric)
      'ten'
    ])
  })

  describe('Search relevance (MiniSearch)', () => {
    const names = (templates: { name: string }[]) =>
      templates.map((template) => template.name)

    const buildTemplate = (
      overrides: Partial<TemplateInfo> & { name: string }
    ): TemplateInfo => ({
      description: '',
      mediaType: 'image',
      mediaSubtype: 'png',
      ...overrides
    })

    async function searchFor(templates: TemplateInfo[], query: string) {
      const composable = useTemplateFiltering(ref(templates))
      composable.searchQuery.value = query
      await nextTick()
      return composable
    }

    it('matches "img2img" via abbreviation expansion', async () => {
      const templates = [
        buildTemplate({
          name: 'z_image_t2i',
          title: 'Z-Image: Text to Image',
          tags: ['Text to Image']
        }),
        buildTemplate({ name: 'video_gen', title: 'LTX Text to Video' })
      ]

      const { filteredTemplates } = await searchFor(templates, 'img2img')

      expect(names(filteredTemplates.value)).toContain('z_image_t2i')
      expect(names(filteredTemplates.value)).not.toContain('video_gen')
    })

    it('matches multi-word cross-field queries like "flux upscale"', async () => {
      const templates = [
        buildTemplate({
          name: 'flux_upscale',
          title: 'Flux.1 Creative Upscale',
          models: ['Flux.1'],
          tags: ['Image Upscale']
        }),
        buildTemplate({
          name: 'flux_txt2img',
          title: 'Flux.1 Text to Image',
          models: ['Flux.1']
        }),
        buildTemplate({
          name: 'seedvr_upscale',
          title: 'SeedVR2 Upscale',
          tags: ['Image Upscale']
        })
      ]

      const { filteredTemplates } = await searchFor(templates, 'flux upscale')

      expect(names(filteredTemplates.value)[0]).toBe('flux_upscale')
    })

    it('breaks near-tied relevance by usage, dampened so it cannot override a better match', async () => {
      const templates = [
        buildTemplate({
          name: 'low_usage_upscale',
          title: 'Alpha Image Upscale',
          tags: ['Image Upscale'],
          usage: 5
        }),
        buildTemplate({
          name: 'high_usage_upscale',
          title: 'Beta Image Upscale',
          tags: ['Image Upscale'],
          usage: 5000
        })
      ]

      const { filteredTemplates } = await searchFor(templates, 'upscale')

      // Near-identical text scores → the far more used template ranks first.
      expect(names(filteredTemplates.value)[0]).toBe('high_usage_upscale')
    })

    it('keeps relevance order even when a usage sort is persisted', async () => {
      const templates = [
        buildTemplate({
          name: 'exact_match',
          title: 'Outpaint Studio',
          tags: ['Outpaint'],
          usage: 1
        }),
        buildTemplate({
          name: 'popular_weak_match',
          title: 'Portrait Generator',
          description: 'supports outpaint as a minor feature',
          usage: 9000
        })
      ]

      const composable = useTemplateFiltering(ref(templates))
      composable.sortBy.value = 'popular'
      composable.searchQuery.value = 'outpaint'
      await nextTick()

      // Search defaults to relevance regardless of the persisted browse sort,
      // so the exact title match wins over the high-usage weak match.
      expect(composable.sortSelection.value).toBe('relevance')
      expect(names(composable.filteredTemplates.value)[0]).toBe('exact_match')
    })

    it('lets the user override relevance with another sort while searching', async () => {
      const templates = [
        buildTemplate({
          name: 'exact_low_usage',
          title: 'Outpaint Studio',
          usage: 1
        }),
        buildTemplate({
          name: 'weak_high_usage',
          title: 'Portrait',
          description: 'outpaint mentioned once',
          usage: 9000
        })
      ]

      const composable = useTemplateFiltering(ref(templates))
      composable.searchQuery.value = 'outpaint'
      await nextTick()
      expect(composable.sortSelection.value).toBe('relevance')
      expect(names(composable.filteredTemplates.value)[0]).toBe(
        'exact_low_usage'
      )

      composable.sortSelection.value = 'popular'
      await nextTick()
      expect(composable.sortSelection.value).toBe('popular')
      expect(names(composable.filteredTemplates.value)[0]).toBe(
        'weak_high_usage'
      )
    })

    it('restores the browse sort when the search is cleared and keeps relevance ephemeral', async () => {
      const composable = useTemplateFiltering(
        ref([buildTemplate({ name: 'only', title: 'Only' })])
      )
      composable.sortBy.value = 'popular'

      composable.searchQuery.value = 'only'
      await nextTick()
      expect(composable.sortSelection.value).toBe('relevance')

      composable.searchQuery.value = ''
      await nextTick()
      // Browse sort is untouched by the search; relevance is never persisted.
      expect(composable.sortSelection.value).toBe('popular')
      expect(composable.sortBy.value).toBe('popular')
    })

    it('keeps a browse sort chosen mid-search ephemeral', async () => {
      const composable = useTemplateFiltering(
        ref([buildTemplate({ name: 'only', title: 'Only' })])
      )
      composable.sortBy.value = 'newest'

      composable.searchQuery.value = 'only'
      await nextTick()
      // Simulates the nav coordinator picking Popular during a search.
      composable.sortSelection.value = 'popular'
      await nextTick()
      expect(composable.sortBy.value).toBe('newest') // persisted sort untouched

      composable.searchQuery.value = ''
      await nextTick()
      expect(composable.sortSelection.value).toBe('newest')
    })

    it('returns no results for a query that matches nothing', async () => {
      const templates = [
        buildTemplate({ name: 'flux_image', title: 'Flux Image' })
      ]

      const { filteredTemplates, filteredCount } = await searchFor(
        templates,
        'zzzznomatch'
      )

      expect(filteredTemplates.value).toEqual([])
      expect(filteredCount.value).toBe(0)
    })

    it('matches the localized title the card displays', async () => {
      const templates = [
        buildTemplate({
          name: 'localized_only',
          title: 'raw english',
          localizedTitle: 'aquarela'
        })
      ]

      const { filteredTemplates } = await searchFor(templates, 'aquarela')

      expect(names(filteredTemplates.value)).toEqual(['localized_only'])
    })

    it('reports the visible sort to telemetry, not the persisted browse sort', async () => {
      vi.useFakeTimers()
      try {
        const composable = useTemplateFiltering(
          ref([buildTemplate({ name: 'only', title: 'Only' })])
        )
        composable.sortBy.value = 'popular'
        composable.searchQuery.value = 'only'
        await nextTick()
        await vi.runOnlyPendingTimersAsync()

        // Searching shows relevance, so telemetry must report relevance, not popular.
        expect(trackTemplateFilterChanged).toHaveBeenLastCalledWith(
          expect.objectContaining({ sort_by: 'relevance' })
        )
      } finally {
        vi.useRealTimers()
      }
    })

    it('preserves relevance order after a model filter narrows the results', async () => {
      const templates = [
        buildTemplate({
          name: 'strong',
          title: 'Flux Upscale Pro',
          models: ['Flux'],
          tags: ['Upscale']
        }),
        buildTemplate({
          name: 'weak',
          title: 'Flux Portrait',
          models: ['Flux'],
          description: 'mentions upscale once'
        })
      ]

      const composable = useTemplateFiltering(ref(templates))
      composable.searchQuery.value = 'upscale'
      composable.selectedModels.value = ['Flux']
      await nextTick()

      // The filter keeps the search order; the stronger match stays first.
      expect(names(composable.filteredTemplates.value)).toEqual([
        'strong',
        'weak'
      ])
    })

    it('narrows to the query then restores the full set when cleared', async () => {
      const templates = [
        buildTemplate({ name: 'alpha_one', title: 'Alpha' }),
        buildTemplate({ name: 'beta_two', title: 'Beta' })
      ]

      const composable = useTemplateFiltering(ref(templates))
      composable.searchQuery.value = 'alpha'
      await nextTick()
      expect(names(composable.filteredTemplates.value)).toEqual(['alpha_one'])

      composable.searchQuery.value = ''
      await nextTick()
      expect(names(composable.filteredTemplates.value)).toHaveLength(2)
    })

    it('records a non-negative largest usage score after an empty-result search', async () => {
      const templates = [
        buildTemplate({ name: 'gamma', title: 'Gamma', usage: 3 }),
        buildTemplate({ name: 'delta', title: 'Delta', usage: 7 })
      ]

      const { filteredTemplates } = await searchFor(templates, 'zzzznomatch')
      expect(filteredTemplates.value).toEqual([])

      // Empty results must yield 0, not -Infinity, which would corrupt
      // usage-normalized ranking scores.
      expect(defaultRankingStore.largestUsageScore).toBe(0)
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

      const {
        selectedModels,
        activeModels,
        inactiveModels,
        filteredTemplates
      } = useTemplateFiltering(templates)

      // Select models from both image and video domains
      selectedModels.value = ['Flux', 'Luma']

      // In image scope, only Flux should be active because Luma doesn't exist in any image template
      expect(activeModels.value).toEqual(['Flux'])
      expect(inactiveModels.value).toEqual(['Luma'])
      expect(filteredTemplates.value).toHaveLength(1)
      expect(filteredTemplates.value[0].name).toBe('flux-template')

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

      const { selectedModels, activeModels } = useTemplateFiltering(templates)

      // Select a model
      selectedModels.value = ['Model1', 'Model2']

      // Model1 is active, Model2 is not available
      expect(activeModels.value).toEqual(['Model1'])
      expect(selectedModels.value).toEqual(['Model1', 'Model2'])

      templates.value = []

      expect(selectedModels.value).toEqual(['Model1', 'Model2'])
      expect(activeModels.value).toEqual([])
    })
  })

  describe('Distribution filtering', () => {
    const setDistribution = (distribution: 'desktop' | 'localhost' | 'cloud') =>
      vi.stubGlobal('__DISTRIBUTION__', distribution)

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
      setDistribution('cloud')
      const templates = ref([cloudTemplate, desktopTemplate, universalTemplate])

      const { filteredTemplates, filteredCount, totalCount } =
        useTemplateFiltering(templates)

      expect(filteredTemplates.value.map((t) => t.name)).toEqual([
        'cloud-only',
        'universal'
      ])
      expect(filteredCount.value).toBe(2)
      expect(totalCount.value).toBe(2)
    })

    it('keeps filteredCount and totalCount consistent with model + distribution filters', () => {
      setDistribution('cloud')
      const fluxCloudTemplate: TemplateInfo = {
        name: 'flux-cloud',
        description: 'Flux on cloud',
        mediaType: 'image',
        mediaSubtype: 'png',
        models: ['Flux'],
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Cloud]
      }

      const templates = ref([cloudTemplate, desktopTemplate, fluxCloudTemplate])

      const { selectedModels, filteredTemplates, filteredCount, totalCount } =
        useTemplateFiltering(templates)

      expect(totalCount.value).toBe(2)

      selectedModels.value = ['Wan 2.2']

      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('cloud-only')
    })

    it('shows all templates when templates have no distribution constraints', () => {
      setDistribution('localhost')
      const templates = ref([
        {
          name: 'template-a',
          description: 'Template A',
          mediaType: 'image',
          mediaSubtype: 'png'
        },
        {
          name: 'template-b',
          description: 'Template B',
          mediaType: 'image',
          mediaSubtype: 'png'
        }
      ])

      const { filteredCount, totalCount } = useTemplateFiltering(templates)

      expect(filteredCount.value).toBe(2)
      expect(totalCount.value).toBe(2)
    })

    it('shows local templates on localhost distribution', () => {
      setDistribution('localhost')
      const localTemplate: TemplateInfo = {
        name: 'local-only',
        description: 'Local template',
        mediaType: 'image',
        mediaSubtype: 'png',
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Local]
      }

      const templates = ref([localTemplate, cloudTemplate, desktopTemplate])

      const { filteredTemplates, filteredCount, totalCount } =
        useTemplateFiltering(templates)

      expect(filteredCount.value).toBe(1)
      expect(totalCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('local-only')
    })

    it('includes templates with multiple distributions when any match', () => {
      setDistribution('cloud')
      const templates = ref([multiDistTemplate])

      const { filteredCount } = useTemplateFiltering(templates)

      expect(filteredCount.value).toBe(1)
    })

    it('excludes templates with multiple distributions when none match', () => {
      setDistribution('localhost')
      const templates = ref([multiDistTemplate])

      const { filteredCount } = useTemplateFiltering(templates)

      expect(filteredCount.value).toBe(0)
    })

    it('reflects distribution changes after re-creating the composable', () => {
      const templates = ref([cloudTemplate, desktopTemplate, universalTemplate])

      setDistribution('cloud')

      const { filteredTemplates, filteredCount, totalCount } =
        useTemplateFiltering(templates)

      expect(filteredTemplates.value.map((t) => t.name)).toEqual([
        'cloud-only',
        'universal'
      ])
      expect(filteredCount.value).toBe(2)
      expect(totalCount.value).toBe(2)

      setDistribution('desktop')

      const {
        filteredTemplates: desktopFilteredTemplates,
        filteredCount: desktopFilteredCount,
        totalCount: desktopTotalCount
      } = useTemplateFiltering(templates)

      expect(desktopFilteredTemplates.value.map((t) => t.name)).toEqual([
        'desktop-only',
        'universal'
      ])
      expect(desktopFilteredCount.value).toBe(2)
      expect(desktopTotalCount.value).toBe(2)
    })

    it('excludes desktop-only models and use cases from filter options on cloud', () => {
      setDistribution('cloud')
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

      const { availableModels, availableUseCases } =
        useTemplateFiltering(templates)

      expect(availableModels.value).toEqual(['Flux'])
      expect(availableModels.value).not.toContain('SD 1.5')
      expect(availableUseCases.value).toEqual(['Image Gen'])
      expect(availableUseCases.value).not.toContain('Inpainting')
    })

    it('distribution filter composes with search filter', async () => {
      vi.useFakeTimers()
      setDistribution('cloud')

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

      const { searchQuery, filteredTemplates, filteredCount } =
        useTemplateFiltering(templates)

      searchQuery.value = 'unique searchable'
      await nextTick()
      await vi.runOnlyPendingTimersAsync()
      await nextTick()

      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('searchable-cloud')
    })

    it('distribution filter composes with use case filter', () => {
      setDistribution('cloud')
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

      const { selectedUseCases, filteredTemplates, filteredCount } =
        useTemplateFiltering(templates)

      selectedUseCases.value = ['Video']

      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('tagged-cloud')
    })

    it('distribution filter composes with runsOn filter', () => {
      setDistribution('cloud')
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

      const { selectedRunsOn, filteredTemplates, filteredCount } =
        useTemplateFiltering(templates)

      selectedRunsOn.value = ['External or Remote API']

      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('api-cloud')
    })

    it('stale persisted model selection does not cause zero results', () => {
      setDistribution('cloud')
      const cloudFlux: TemplateInfo = {
        name: 'cloud-flux',
        description: 'Flux on cloud',
        mediaType: 'image',
        mediaSubtype: 'png',
        models: ['Flux'],
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Cloud]
      }

      const templates = ref([cloudFlux])

      const {
        selectedModels,
        activeModels,
        inactiveModels,
        filteredTemplates,
        filteredCount
      } = useTemplateFiltering(templates)

      selectedModels.value = ['SD 1.5']

      expect(activeModels.value).toEqual([])
      expect(inactiveModels.value).toEqual(['SD 1.5'])
      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('cloud-flux')
    })

    it('mac distribution matches templates with mac includeOnDistributions', () => {
      setDistribution('desktop')
      mockSystemStatsStore.systemStats.system.os = 'darwin'

      const macTemplate: TemplateInfo = {
        name: 'mac-template',
        description: 'Mac only',
        mediaType: 'image',
        mediaSubtype: 'png',
        includeOnDistributions: [TemplateIncludeOnDistributionEnum.Mac]
      }

      const templates = ref([macTemplate, cloudTemplate])

      const { filteredTemplates, filteredCount } =
        useTemplateFiltering(templates)

      expect(filteredCount.value).toBe(1)
      expect(filteredTemplates.value[0].name).toBe('mac-template')
    })
  })
})
