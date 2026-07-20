import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import type { WorkflowTemplates } from '@/platform/workflow/templates/types/template'
import type { NavGroupData, NavItemData } from '@/types/navTypes'

const {
  coreByLocale,
  coreErrorLocales,
  coreResult,
  customResult,
  dist,
  locale
} = vi.hoisted(() => ({
  coreByLocale: { value: {} as Record<string, unknown[]> },
  coreErrorLocales: { value: new Set<string>() },
  coreResult: { value: [] as unknown[] },
  customResult: { value: {} as Record<string, string[]> },
  dist: { isCloud: false },
  locale: { value: 'en' }
}))

const baseTemplate = {
  name: 'default',
  title: 'Default',
  description: 'A basic template',
  mediaType: 'image',
  mediaSubtype: 'webp'
}

vi.mock('@/scripts/api', () => ({
  api: {
    getWorkflowTemplates: async () => customResult.value,
    getCoreWorkflowTemplates: async (locale: string) => {
      if (coreErrorLocales.value.has(locale)) throw new Error('core failed')
      return coreByLocale.value[locale] ?? coreResult.value
    },
    fileURL: (p: string) => p
  }
}))

vi.mock('@/i18n', async () => {
  const { ref } = await import('vue')
  const localeRef = ref(locale.value)
  Object.defineProperty(locale, 'value', {
    get: () => localeRef.value,
    set: (value: string) => {
      localeRef.value = value
    }
  })
  return {
    i18n: { global: { locale } },
    st: (_key: string, fallback: string) => fallback
  }
})

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return dist.isCloud
  }
}))

function coreCategory(
  overrides: Partial<WorkflowTemplates> = {}
): WorkflowTemplates {
  return {
    moduleName: 'default',
    title: 'Basics',
    type: 'image',
    templates: [baseTemplate],
    ...overrides
  }
}

function navItems(items: (NavItemData | NavGroupData)[]) {
  return items.flatMap((item) => ('items' in item ? item.items : [item]))
}

beforeEach(() => {
  setActivePinia(createPinia())
  coreByLocale.value = {}
  coreErrorLocales.value = new Set()
  coreResult.value = [coreCategory()]
  customResult.value = {}
  dist.isCloud = false
  locale.value = 'en'
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () => new Response('', { headers: { 'content-type': 'text/html' } })
    )
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('workflowTemplatesStore', () => {
  it('loads core templates and indexes their names', async () => {
    const store = useWorkflowTemplatesStore()
    expect(store.isLoaded).toBe(false)

    await store.loadWorkflowTemplates()

    expect(store.isLoaded).toBe(true)
    expect(store.knownTemplateNames.has('default')).toBe(true)
    expect(store.getTemplateByName('default')?.name).toBe('default')
    expect(store.getTemplateByName('missing')).toBeUndefined()
  })

  it('exposes grouped templates with localized titles', async () => {
    const store = useWorkflowTemplatesStore()
    await store.loadWorkflowTemplates()

    expect(store.groupedTemplates.length).toBeGreaterThan(0)
    const allNames = store.groupedTemplates.flatMap((g) =>
      (g.modules ?? []).flatMap((m) => (m.templates ?? []).map((t) => t.name))
    )
    expect(allNames).toContain('default')
  })

  it('filters nav categories from loaded template metadata', async () => {
    coreResult.value = [
      coreCategory({
        title: 'Getting Started',
        isEssential: true,
        templates: [{ ...baseTemplate, name: 'starter', title: 'Starter' }]
      }),
      coreCategory({
        title: 'Image Tools',
        category: 'GENERATION TYPE',
        templates: [
          {
            ...baseTemplate,
            name: 'partner-upscale',
            title: 'Partner Upscale',
            openSource: false
          },
          {
            ...baseTemplate,
            name: 'local-only',
            requiresCustomNodes: ['custom-node']
          }
        ]
      }),
      coreCategory({
        title: 'Image Tools',
        category: 'OTHER GROUP',
        templates: [
          {
            ...baseTemplate,
            name: 'other-image',
            title: 'Other Image'
          }
        ]
      }),
      coreCategory({
        title: 'Video Tools',
        category: 'GENERATION TYPE',
        icon: 'icon-custom',
        type: undefined,
        templates: [
          {
            ...baseTemplate,
            name: 'video-tool',
            title: 'Video Tool'
          }
        ]
      })
    ]
    customResult.value = { CustomPack: ['custom-flow'] }
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    const allItems = navItems(store.navGroupedTemplates)
    const basicsId = allItems.find(
      (item) => item.label === 'Getting Started'
    )?.id
    const categoryId = allItems.find((item) => item.label === 'Image Tools')?.id

    expect(store.filterTemplatesByCategory('all').map((t) => t.name)).toEqual([
      'starter',
      'partner-upscale',
      'other-image',
      'video-tool',
      'custom-flow'
    ])
    expect(
      store.filterTemplatesByCategory('popular').map((t) => t.name)
    ).toEqual([
      'starter',
      'partner-upscale',
      'other-image',
      'video-tool',
      'custom-flow'
    ])
    expect(
      store.filterTemplatesByCategory(basicsId ?? '').map((t) => t.name)
    ).toEqual(['starter'])
    expect(
      store.filterTemplatesByCategory(categoryId ?? '').map((t) => t.name)
    ).toEqual(['partner-upscale'])
    expect(
      store.filterTemplatesByCategory('partner-nodes').map((t) => t.name)
    ).toEqual(['partner-upscale'])
    expect(
      store.filterTemplatesByCategory('extension-CustomPack').map((t) => t.name)
    ).toEqual(['custom-flow'])
    expect(
      store.filterTemplatesByCategory('unknown').map((t) => t.name)
    ).toEqual([
      'starter',
      'partner-upscale',
      'other-image',
      'video-tool',
      'custom-flow'
    ])
  })

  it('loads logo indexes and rejects unsafe logo paths', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          valid: 'logos/valid.svg',
          missingExtension: 'logos/valid',
          parent: '../secret.svg',
          rooted: '/logos/rooted.svg'
        }),
        { headers: { 'content-type': 'application/json' } }
      )
    )
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    expect(store.getLogoUrl('valid')).toBe('/templates/logos/valid.svg')
    expect(store.getLogoUrl('missing')).toBe('')
    expect(store.getLogoUrl('missingExtension')).toBe('')
    expect(store.getLogoUrl('parent')).toBe('')
    expect(store.getLogoUrl('rooted')).toBe('')
  })

  it('ignores invalid and failed logo indexes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: 1 }), {
        headers: { 'content-type': 'application/json' }
      })
    )
    const invalidStore = useWorkflowTemplatesStore()

    await invalidStore.loadWorkflowTemplates()

    expect(invalidStore.getLogoUrl('valid')).toBe('')

    setActivePinia(createPinia())
    vi.mocked(fetch).mockRejectedValueOnce(new Error('logo failed'))
    const failedStore = useWorkflowTemplatesStore()

    await failedStore.loadWorkflowTemplates()

    expect(failedStore.getLogoUrl('valid')).toBe('')
  })

  it('includes cloud-only templates and custom groups when requested', async () => {
    dist.isCloud = true
    coreResult.value = [
      coreCategory({
        title: 'Cloud Templates',
        templates: [
          {
            name: 'metadata-light',
            description: '',
            mediaType: 'image',
            mediaSubtype: 'webp',
            requiresCustomNodes: ['custom-node']
          }
        ]
      })
    ]
    customResult.value = { CustomPack: ['custom-flow'] }
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    expect(store.enhancedTemplates.map((t) => t.name)).toEqual([
      'metadata-light',
      'custom-flow'
    ])
    expect(
      store.groupedTemplates.find((group) => group.label === 'Custom Nodes')
    ).toBeDefined()
    expect(store.getTemplateByName('metadata-light')?.searchableText).toBe(
      'metadata-light  Cloud Templates'
    )
  })

  it('omits optional nav sections when templates do not need them', async () => {
    coreResult.value = [
      coreCategory({
        templates: [{ ...baseTemplate, openSource: true }]
      })
    ]
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    const items = store.navGroupedTemplates
    const flatItems = navItems(items)

    expect(flatItems.map((item) => item.id)).toEqual(['all', 'popular'])
    expect(
      items.some((item) => 'title' in item && item.title === 'Extensions')
    ).toBe(false)
  })

  it('uses fallback icons for essential and grouped nav entries', async () => {
    coreResult.value = [
      coreCategory({
        title: 'Getting Started',
        isEssential: true,
        type: undefined
      }),
      coreCategory({
        title: 'Model Tools',
        category: 'MODEL TYPE',
        type: undefined
      })
    ]
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    const flatItems = navItems(store.navGroupedTemplates)

    expect(
      flatItems.find((item) => item.label === 'Getting Started')?.icon
    ).toBe('icon-[lucide--graduation-cap]')
    expect(flatItems.find((item) => item.label === 'Model Tools')?.icon).toBe(
      'icon-[lucide--folder]'
    )
  })

  it('returns english metadata when cloud loads a non-english locale', async () => {
    dist.isCloud = true
    locale.value = 'fr'
    coreByLocale.value = {
      fr: [
        coreCategory({
          templates: [{ ...baseTemplate, name: 'localized', title: 'Localise' }]
        })
      ],
      en: [
        coreCategory({
          title: 'English Category',
          templates: [
            {
              ...baseTemplate,
              name: 'localized',
              tags: ['tag'],
              useCase: 'test',
              models: ['model'],
              license: 'MIT'
            }
          ]
        })
      ]
    }
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    expect(store.getEnglishMetadata('localized')).toEqual({
      tags: ['tag'],
      category: 'English Category',
      useCase: 'test',
      models: ['model'],
      license: 'MIT'
    })
    expect(store.getEnglishMetadata('missing')).toBeNull()
  })

  it('does not refetch once loaded', async () => {
    const store = useWorkflowTemplatesStore()
    await store.loadWorkflowTemplates()

    coreResult.value = []
    await store.loadWorkflowTemplates()

    expect(store.knownTemplateNames.has('default')).toBe(true)
  })

  it('returns null english metadata when no english templates are loaded', async () => {
    const store = useWorkflowTemplatesStore()
    await store.loadWorkflowTemplates()

    expect(store.getEnglishMetadata('default')).toBeNull()
  })

  it('reloads loaded templates when locale changes', async () => {
    coreByLocale.value = {
      en: [
        coreCategory({
          templates: [{ ...baseTemplate, name: 'english' }]
        })
      ],
      fr: [
        coreCategory({
          templates: [{ ...baseTemplate, name: 'french' }]
        })
      ]
    }
    const store = useWorkflowTemplatesStore()

    locale.value = 'fr'
    await nextTick()
    await store.loadWorkflowTemplates()

    expect(store.knownTemplateNames.has('french')).toBe(true)

    coreByLocale.value.es = [
      coreCategory({
        templates: [{ ...baseTemplate, name: 'spanish' }]
      })
    ]
    locale.value = 'es'

    await vi.waitFor(() => {
      expect(store.knownTemplateNames.has('spanish')).toBe(true)
    })
  })

  it('keeps existing templates when locale reload fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = useWorkflowTemplatesStore()
    await store.loadWorkflowTemplates()

    coreErrorLocales.value.add('fr')
    locale.value = 'fr'

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        'Error reloading templates for new locale:',
        expect.any(Error)
      )
    })
    expect(store.knownTemplateNames.has('default')).toBe(true)
  })
})
