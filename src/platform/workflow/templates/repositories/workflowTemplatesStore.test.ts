import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import type { WorkflowTemplates } from '@/platform/workflow/templates/types/template'
import type { NavGroupData, NavItemData } from '@/types/navTypes'

const { coreByLocale, coreResult, customResult, dist, locale } = vi.hoisted(
  () => ({
    coreByLocale: { value: {} as Record<string, unknown[]> },
    coreResult: { value: [] as unknown[] },
    customResult: { value: {} as Record<string, string[]> },
    dist: { isCloud: false },
    locale: { value: 'en' }
  })
)

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
    getCoreWorkflowTemplates: async (locale: string) =>
      coreByLocale.value[locale] ?? coreResult.value,
    fileURL: (p: string) => p
  }
}))

vi.mock('@/i18n', () => ({
  i18n: { global: { locale } },
  st: (_key: string, fallback: string) => fallback
}))

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
      'custom-flow'
    ])
    expect(
      store.filterTemplatesByCategory('popular').map((t) => t.name)
    ).toEqual(['starter', 'partner-upscale', 'custom-flow'])
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
    ).toEqual(['starter', 'partner-upscale', 'custom-flow'])
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
})
