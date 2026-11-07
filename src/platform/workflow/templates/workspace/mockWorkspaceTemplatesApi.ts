import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import type { TemplateInfo } from '@comfyorg/api-client/templateTypes'

import type {
  CreateWorkspaceTemplateRequest,
  UpdateWorkspaceTemplateRequest,
  WorkspaceTemplatePermissionsResponse,
  WorkspaceTemplateRequirements,
  WorkspaceTemplateResponse,
  WorkspaceTemplatesApi,
  WorkspaceTemplateThumbnailInput
} from './workspaceTemplateTypes'

/** What the mock server knows about the request, as a real one would from the session. */
export interface MockWorkspaceTemplatesContext {
  workspaceId: string | null
  viewer: () => { id: string; name: string }
  officialTemplate: (name: string) => TemplateInfo | undefined
  officialThumbnailUrl: (template: TemplateInfo, index: '1' | '2') => string
  fetchOfficialWorkflow: (name: string) => Promise<ComfyWorkflowJSON | null>
}

interface StoredTemplate {
  id: string
  title: string
  description: string
  createdBy: { id: string; name: string }
  createdAt: string
  updatedAt: string
  thumbnail: WorkspaceTemplateThumbnailInput
  requirements: WorkspaceTemplateRequirements
  workflow: ComfyWorkflowJSON
}

type TemplateSummary = Omit<StoredTemplate, 'workflow'>

interface StoredWorkspace {
  added: StoredTemplate[]
  seedEdits: Record<string, UpdateWorkspaceTemplateRequest>
  deletedSeeds: string[]
}

interface SeedSpec {
  officialName: string
  title: string
  description: string
  author: { id: string; name: string }
  daysAgo: number
}

const SEEDS: SeedSpec[] = [
  {
    officialName: 'image_flux2_fp8',
    title: 'Packaging mockup',
    description:
      'Mugs and pouches on a sunlit table. Describe your print in the prompt and run.',
    author: { id: 'mock-teammate-ana', name: 'Ana' },
    daysAgo: 1
  },
  {
    officialName: 'templates_graphic_design_recomposer',
    title: 'Campaign key visual',
    description:
      'Recompose an event poster around a new title, date and hero image.',
    author: { id: 'mock-teammate-marco', name: 'Marco' },
    daysAgo: 4
  },
  {
    officialName: 'templates-character_sheet',
    title: 'Character turnaround',
    description:
      'Front, side and back views of one character from a single reference image.',
    author: { id: 'mock-teammate-ana', name: 'Ana' },
    daysAgo: 9
  },
  {
    officialName: 'templates-portrait_light_migration',
    title: 'Portrait relight',
    description: 'Move the light on a portrait without changing the face.',
    author: { id: 'mock-teammate-priya', name: 'Priya' },
    daysAgo: 15
  },
  {
    officialName: 'templates-car_product',
    title: 'Car product shots',
    description: 'Studio and street shots of a car from one photo.',
    author: { id: 'mock-teammate-marco', name: 'Marco' },
    daysAgo: 22
  },
  {
    officialName: 'template-multistyle-magazine-cover-nanobananapro',
    title: 'Magazine cover',
    description:
      'Cover and packaging layouts for one product in several styles.',
    author: { id: 'mock-teammate-priya', name: 'Priya' },
    daysAgo: 30
  }
]

const SEED_ID_PREFIX = 'seed:'
const TITLE_MAX_LENGTH = 120
const DESCRIPTION_MAX_LENGTH = 2000
const DAY_MS = 24 * 60 * 60 * 1000

type MockWorkspaceTemplatesErrorCode =
  | 'workspace_templates_unavailable'
  | 'forbidden'
  | 'not_found'
  | 'invalid_request'

export class MockWorkspaceTemplatesError extends Error {
  constructor(readonly code: MockWorkspaceTemplatesErrorCode) {
    super(code)
  }
}

function storageKey(workspaceId: string) {
  return `Comfy.WorkspaceTemplates.Mock.${workspaceId}`
}

function emptyWorkspace(): StoredWorkspace {
  return { added: [], seedEdits: {}, deletedSeeds: [] }
}

function isStoredWorkspace(value: unknown): value is StoredWorkspace {
  if (typeof value !== 'object' || value === null) return false
  return (
    'added' in value &&
    Array.isArray(value.added) &&
    'deletedSeeds' in value &&
    Array.isArray(value.deletedSeeds) &&
    'seedEdits' in value &&
    typeof value.seedEdits === 'object' &&
    value.seedEdits !== null
  )
}

function seedRequirements(
  template: TemplateInfo
): WorkspaceTemplateRequirements {
  return {
    models: (template.models ?? []).map((name) => ({ name, directory: '' })),
    custom_nodes: (template.requiresCustomNodes ?? []).map((name) => ({
      package: name,
      node_types: []
    })),
    uses_partner_nodes: template.openSource === false,
    is_app: template.isApp === true
  }
}

function assertValidDetails(details: UpdateWorkspaceTemplateRequest) {
  if (details.title !== undefined) {
    const title = details.title.trim()
    if (!title || title.length > TITLE_MAX_LENGTH)
      throw new MockWorkspaceTemplatesError('invalid_request')
  }
  if (
    details.description !== undefined &&
    details.description.length > DESCRIPTION_MAX_LENGTH
  )
    throw new MockWorkspaceTemplatesError('invalid_request')
}

function trimmedDetails(body: UpdateWorkspaceTemplateRequest) {
  return {
    ...(body.title !== undefined && { title: body.title.trim() }),
    ...(body.description !== undefined && {
      description: body.description.trim()
    })
  }
}

/**
 * The proposed `/api/workspace/templates` endpoints, kept in this browser's
 * local storage for any workspace. Only a template's creator may change one.
 */
export function createMockWorkspaceTemplatesApi(
  getContext: () => MockWorkspaceTemplatesContext,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now: () => Date = () => new Date()
): WorkspaceTemplatesApi {
  function workspaceContext() {
    const context = getContext()
    if (!context.workspaceId)
      throw new MockWorkspaceTemplatesError('workspace_templates_unavailable')
    return { ...context, workspaceId: context.workspaceId }
  }

  function readWorkspace(workspaceId: string): StoredWorkspace {
    const raw = storage.getItem(storageKey(workspaceId))
    if (!raw) return emptyWorkspace()
    try {
      const parsed: unknown = JSON.parse(raw)
      return isStoredWorkspace(parsed) ? parsed : emptyWorkspace()
    } catch {
      return emptyWorkspace()
    }
  }

  function writeWorkspace(workspaceId: string, workspace: StoredWorkspace) {
    storage.setItem(storageKey(workspaceId), JSON.stringify(workspace))
  }

  function seedTemplates(
    context: MockWorkspaceTemplatesContext,
    workspace: StoredWorkspace
  ): TemplateSummary[] {
    return SEEDS.flatMap((seed) => {
      const id = `${SEED_ID_PREFIX}${seed.officialName}`
      if (workspace.deletedSeeds.includes(id)) return []
      const official = context.officialTemplate(seed.officialName)
      if (!official) return []
      const createdAt = new Date(
        now().getTime() - seed.daysAgo * DAY_MS
      ).toISOString()
      const isComparison = official.thumbnailVariant === 'compareSlider'
      return [
        {
          id,
          title: seed.title,
          description: seed.description,
          ...workspace.seedEdits[id],
          createdBy: seed.author,
          createdAt,
          updatedAt: createdAt,
          thumbnail: {
            type: isComparison ? 'image_comparison' : 'image',
            url: context.officialThumbnailUrl(official, '1'),
            comparisonUrl: isComparison
              ? context.officialThumbnailUrl(official, '2')
              : null
          },
          requirements: seedRequirements(official)
        }
      ]
    })
  }

  function toResponse(
    context: MockWorkspaceTemplatesContext,
    template: TemplateSummary
  ): WorkspaceTemplateResponse {
    const addedByViewer = template.createdBy.id === context.viewer().id
    return {
      id: template.id,
      title: template.title,
      description: template.description,
      created_by: template.createdBy,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
      thumbnail_url: template.thumbnail.url,
      thumbnail_type: template.thumbnail.type,
      comparison_url: template.thumbnail.comparisonUrl,
      requirements: template.requirements,
      viewer_can_edit: addedByViewer,
      viewer_can_delete: addedByViewer
    }
  }

  function allTemplates(
    context: MockWorkspaceTemplatesContext,
    workspace: StoredWorkspace
  ): TemplateSummary[] {
    return [...workspace.added, ...seedTemplates(context, workspace)]
  }

  function findManageable(id: string) {
    const context = workspaceContext()
    const workspace = readWorkspace(context.workspaceId)
    const template = allTemplates(context, workspace).find((t) => t.id === id)
    if (!template) throw new MockWorkspaceTemplatesError('not_found')
    if (!toResponse(context, template).viewer_can_edit)
      throw new MockWorkspaceTemplatesError('forbidden')
    return { context, workspace, template }
  }

  return {
    async getPermissions(): Promise<WorkspaceTemplatePermissionsResponse> {
      const hasWorkspace = getContext().workspaceId !== null
      return {
        'workspace_templates:view': hasWorkspace,
        'workspace_templates:create': hasWorkspace
      }
    },

    async list() {
      const context = workspaceContext()
      const workspace = readWorkspace(context.workspaceId)
      return allTemplates(context, workspace)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((template) => toResponse(context, template))
    },

    async getWorkflow(id) {
      const context = workspaceContext()
      if (id.startsWith(SEED_ID_PREFIX))
        return context.fetchOfficialWorkflow(id.slice(SEED_ID_PREFIX.length))
      const workspace = readWorkspace(context.workspaceId)
      return workspace.added.find((t) => t.id === id)?.workflow ?? null
    },

    async create(body: CreateWorkspaceTemplateRequest) {
      const context = workspaceContext()
      assertValidDetails(body)
      if (!body.thumbnail.url)
        throw new MockWorkspaceTemplatesError('invalid_request')
      const timestamp = now().toISOString()
      const template: StoredTemplate = {
        id: crypto.randomUUID(),
        title: body.title.trim(),
        description: body.description.trim(),
        createdBy: context.viewer(),
        createdAt: timestamp,
        updatedAt: timestamp,
        thumbnail: body.thumbnail,
        requirements: body.requirements,
        workflow: body.workflow_json
      }
      const workspace = readWorkspace(context.workspaceId)
      writeWorkspace(context.workspaceId, {
        ...workspace,
        added: [template, ...workspace.added]
      })
      return toResponse(context, template)
    },

    async update(id, body) {
      assertValidDetails(body)
      const { context, workspace, template } = findManageable(id)
      const details = trimmedDetails(body)
      const updatedAt = now().toISOString()
      writeWorkspace(
        context.workspaceId,
        id.startsWith(SEED_ID_PREFIX)
          ? {
              ...workspace,
              seedEdits: {
                ...workspace.seedEdits,
                [id]: { ...workspace.seedEdits[id], ...details }
              }
            }
          : {
              ...workspace,
              added: workspace.added.map((t) =>
                t.id === id ? { ...t, ...details, updatedAt } : t
              )
            }
      )
      return toResponse(context, { ...template, ...details, updatedAt })
    },

    async remove(id) {
      const { context, workspace } = findManageable(id)
      writeWorkspace(
        context.workspaceId,
        id.startsWith(SEED_ID_PREFIX)
          ? { ...workspace, deletedSeeds: [...workspace.deletedSeeds, id] }
          : { ...workspace, added: workspace.added.filter((t) => t.id !== id) }
      )
    }
  }
}
