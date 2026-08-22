import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkflowTemplates } from '@/platform/workflow/templates/types/template'

const apiMocks = vi.hoisted(() => ({
  fileURL: vi.fn<(path: string) => string>(),
  getCoreWorkflowTemplates: vi.fn(),
  getWorkflowTemplates: vi.fn()
}))

const distribution = vi.hoisted(() => ({
  isCloud: false,
  isDesktop: true
}))

vi.mock('@/i18n', async () => {
  const { ref } = await import('vue')

  return {
    i18n: { global: { locale: ref('en') } },
    st: (_key: string, fallback: string) => fallback
  }
})

vi.mock('@/platform/distribution/types', () => distribution)

vi.mock('@/scripts/api', () => ({ api: apiMocks }))

import { useWorkflowTemplatesStore } from './workflowTemplatesStore'

const templateCatalog: WorkflowTemplates[] = [
  {
    moduleName: 'default',
    title: 'Test Templates',
    templates: [
      {
        name: 'plain-template',
        description: 'Uses built-in nodes',
        mediaType: 'image',
        mediaSubtype: 'webp'
      },
      {
        name: 'custom-node-template',
        description: 'Uses a registry node pack',
        mediaType: 'image',
        mediaSubtype: 'webp',
        requiresCustomNodes: ['comfyui-kjnodes']
      }
    ]
  }
]

describe('workflowTemplatesStore custom-node visibility', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    distribution.isCloud = false
    distribution.isDesktop = true
    apiMocks.fileURL.mockImplementation((path) => `mock-file-url${path}`)
    apiMocks.getWorkflowTemplates.mockResolvedValue({})
    apiMocks.getCoreWorkflowTemplates.mockResolvedValue(templateCatalog)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{}', {
          headers: { 'content-type': 'application/json' }
        })
      )
    )
  })

  it('keeps declared custom-node templates visible on Desktop', async () => {
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    expect(store.enhancedTemplates.map((template) => template.name)).toEqual([
      'plain-template',
      'custom-node-template'
    ])
    expect(
      store.enhancedTemplates.find(
        (template) => template.name === 'custom-node-template'
      )
    ).toMatchObject({ requiresCustomNodes: ['comfyui-kjnodes'] })
  })

  it('continues hiding custom-node templates on localhost', async () => {
    distribution.isDesktop = false
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    expect(store.enhancedTemplates.map((template) => template.name)).toEqual([
      'plain-template'
    ])
  })
})
