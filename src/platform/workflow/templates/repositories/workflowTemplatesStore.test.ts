import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { api } from '@/scripts/api'

describe('useWorkflowTemplatesStore template keys', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 }))
    )
    vi.spyOn(api, 'getWorkflowTemplates').mockResolvedValue({
      'pack-a': ['decimate'],
      'pack-b': ['decimate']
    })
    vi.spyOn(api, 'getCoreWorkflowTemplates').mockResolvedValue([
      {
        moduleName: 'default',
        title: 'Basics',
        templates: [
          {
            name: 'default_workflow',
            description: '',
            mediaType: 'image',
            mediaSubtype: 'webp'
          }
        ]
      }
    ])
  })

  it('qualifies custom template keys by pack and keeps core keys as names', async () => {
    const store = useWorkflowTemplatesStore()
    await store.loadWorkflowTemplates()

    expect(
      store.enhancedTemplates.map(({ name, templateKey }) => ({
        name,
        templateKey
      }))
    ).toEqual([
      { name: 'default_workflow', templateKey: 'default_workflow' },
      { name: 'decimate', templateKey: 'pack-a/decimate' },
      { name: 'decimate', templateKey: 'pack-b/decimate' }
    ])
  })
})
