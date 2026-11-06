import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import type { TemplateInfo } from '@comfyorg/api-client/templateTypes'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { MockWorkspaceTemplatesContext } from './mockWorkspaceTemplatesApi'
import { createMockWorkspaceTemplatesApi } from './mockWorkspaceTemplatesApi'
import type { CreateWorkspaceTemplateRequest } from './workspaceTemplateTypes'

const OFFICIAL_TEMPLATES: Record<string, TemplateInfo> = {
  image_flux2_fp8: {
    name: 'image_flux2_fp8',
    description: 'Flux 2',
    mediaType: 'image',
    mediaSubtype: 'webp',
    models: ['flux2.safetensors']
  },
  'templates-character_sheet': {
    name: 'templates-character_sheet',
    description: 'Character sheet',
    mediaType: 'image',
    mediaSubtype: 'webp',
    thumbnailVariant: 'compareSlider',
    openSource: false
  }
}

const officialWorkflow = fromPartial<ComfyWorkflowJSON>({
  version: 0.4,
  nodes: []
})
const addedWorkflow = fromPartial<ComfyWorkflowJSON>({
  version: 0.4,
  nodes: [],
  links: []
})

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value)
  }
}

function setup(overrides: Partial<MockWorkspaceTemplatesContext> = {}) {
  const context: MockWorkspaceTemplatesContext = {
    workspaceId: 'ws-1',
    viewer: () => ({ id: 'me', name: 'Me' }),
    officialTemplate: (name) => OFFICIAL_TEMPLATES[name],
    officialThumbnailUrl: (template, index) =>
      `/templates/${template.name}-${index}.${template.mediaSubtype}`,
    fetchOfficialWorkflow: vi.fn(async () => officialWorkflow),
    ...overrides
  }
  const api = createMockWorkspaceTemplatesApi(
    () => context,
    memoryStorage(),
    () => new Date('2026-11-06T12:00:00Z')
  )
  return { api, context }
}

function createRequest(
  overrides: Partial<CreateWorkspaceTemplateRequest> = {}
): CreateWorkspaceTemplateRequest {
  return {
    title: '  Product in hand  ',
    description: 'A hand holds the product.',
    workflow_json: addedWorkflow,
    thumbnail: {
      type: 'image',
      url: 'data:image/webp;base64,AA',
      comparisonUrl: null
    },
    requirements: {
      models: [],
      custom_nodes: [],
      uses_partner_nodes: false,
      is_app: false
    },
    ...overrides
  }
}

describe('createMockWorkspaceTemplatesApi', () => {
  it.for([
    { workspaceId: 'ws-1', expected: true },
    { workspaceId: null, expected: false }
  ])(
    'grants view and create whenever a workspace is active ($workspaceId)',
    async ({ workspaceId, expected }) => {
      const { api } = setup({ workspaceId })

      await expect(api.getPermissions()).resolves.toEqual({
        'workspace_templates:view': expected,
        'workspace_templates:create': expected
      })
    }
  )

  it('refuses to list templates before a workspace is active', async () => {
    const { api } = setup({ workspaceId: null })

    await expect(api.list()).rejects.toMatchObject({
      code: 'workspace_templates_unavailable'
    })
  })

  it('lists the seeded teammate templates the official index still has, newest first, as read-only', async () => {
    const { api } = setup()

    const templates = await api.list()

    expect(templates.map((t) => t.title)).toEqual([
      'Packaging mockup',
      'Character turnaround'
    ])
    expect(templates[1]).toMatchObject({
      thumbnail_type: 'image_comparison',
      thumbnail_url: '/templates/templates-character_sheet-1.webp',
      comparison_url: '/templates/templates-character_sheet-2.webp',
      requirements: { uses_partner_nodes: true },
      viewer_can_edit: false,
      viewer_can_delete: false
    })
  })

  it('adds a template the viewer can manage and lists it first', async () => {
    const { api } = setup()

    const created = await api.create(createRequest())
    const templates = await api.list()

    expect(created).toMatchObject({
      title: 'Product in hand',
      created_by: { id: 'me', name: 'Me' },
      viewer_can_edit: true,
      viewer_can_delete: true
    })
    expect(templates[0].id).toBe(created.id)
    await expect(api.getWorkflow(created.id)).resolves.toEqual(addedWorkflow)
  })

  it.for([
    { title: '   ', thumbnailUrl: 'data:x' },
    { title: 'x'.repeat(121), thumbnailUrl: 'data:x' },
    { title: 'Fine', thumbnailUrl: '' }
  ])(
    'rejects a template without a usable title or thumbnail ($title)',
    async ({ title, thumbnailUrl }) => {
      const { api } = setup()

      await expect(
        api.create(
          createRequest({
            title,
            thumbnail: { type: 'image', url: thumbnailUrl, comparisonUrl: null }
          })
        )
      ).rejects.toMatchObject({ code: 'invalid_request' })
    }
  )

  it('edits and deletes only templates the viewer added', async () => {
    const { api } = setup()
    const created = await api.create(createRequest())

    const updated = await api.update(created.id, {
      title: 'Product shot',
      description: 'New description'
    })
    await expect(
      api.update('seed:image_flux2_fp8', { title: 'Mine now' })
    ).rejects.toMatchObject({ code: 'forbidden' })
    await expect(api.remove('seed:image_flux2_fp8')).rejects.toMatchObject({
      code: 'forbidden'
    })
    await api.remove(created.id)

    expect(updated).toMatchObject({
      title: 'Product shot',
      description: 'New description'
    })
    expect((await api.list()).map((t) => t.id)).not.toContain(created.id)
  })

  it('opens a seeded template from the official workflow it was made from', async () => {
    const { api, context } = setup()

    const workflow = await api.getWorkflow('seed:image_flux2_fp8')

    expect(workflow).toBe(officialWorkflow)
    expect(context.fetchOfficialWorkflow).toHaveBeenCalledWith(
      'image_flux2_fp8'
    )
  })

  it('keeps each workspace’s templates apart', async () => {
    const storage = memoryStorage()
    let workspaceId = 'ws-1'
    const api = createMockWorkspaceTemplatesApi(
      () => ({ ...setup().context, workspaceId }),
      storage
    )

    const created = await api.create(createRequest())
    workspaceId = 'ws-2'

    expect((await api.list()).map((t) => t.id)).not.toContain(created.id)
  })
})
