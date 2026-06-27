import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'

const { coreResult, customResult } = vi.hoisted(() => ({
  coreResult: {
    value: [] as unknown[]
  },
  customResult: { value: {} as Record<string, string[]> }
}))

vi.mock('@/scripts/api', () => ({
  api: {
    getWorkflowTemplates: async () => customResult.value,
    getCoreWorkflowTemplates: async () => coreResult.value,
    fileURL: (p: string) => p
  }
}))

vi.mock('@/i18n', () => ({
  i18n: { global: { locale: { value: 'en' } } },
  st: (_key: string, fallback: string) => fallback
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return false
  }
}))

function coreCategory() {
  return {
    moduleName: 'comfy_core',
    title: 'Basics',
    type: 'image',
    templates: [
      {
        name: 'default',
        title: 'Default',
        description: 'A basic template',
        mediaType: 'image',
        mediaSubtype: 'webp'
      }
    ]
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  coreResult.value = [coreCategory()]
  customResult.value = {}
  vi.stubGlobal(
    'fetch',
    async () => ({ headers: { get: () => 'text/html' } }) as never
  )
})

describe('workflowTemplatesStore', () => {
  it('loads core templates and indexes their names', async () => {
    const store = useWorkflowTemplatesStore()
    expect(store.isLoaded).toBe(false)

    await store.loadWorkflowTemplates()

    expect(store.isLoaded).toBe(true)
    expect(store.knownTemplateNames.has('default')).toBe(true)
    expect(store.getTemplateByName('default')).toBeDefined()
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

  it('does not refetch once loaded', async () => {
    const store = useWorkflowTemplatesStore()
    await store.loadWorkflowTemplates()

    coreResult.value = [] // would empty the store if refetched
    await store.loadWorkflowTemplates()

    expect(store.knownTemplateNames.has('default')).toBe(true)
  })

  it('returns null english metadata when no english templates are loaded', async () => {
    const store = useWorkflowTemplatesStore()
    await store.loadWorkflowTemplates()

    expect(store.getEnglishMetadata('default')).toBeNull()
  })
})
