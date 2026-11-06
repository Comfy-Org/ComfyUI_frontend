import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import type { TemplateInfo } from '@comfyorg/api-client/templateTypes'
import { reportError } from '@comfyorg/telemetry/reportError'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { t } from '@/i18n'
import type { EnhancedTemplate } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

import {
  createMockWorkspaceTemplatesApi,
  MockWorkspaceTemplatesError
} from './mockWorkspaceTemplatesApi'
import type {
  CreateWorkspaceTemplateRequest,
  UpdateWorkspaceTemplateRequest,
  WorkspaceTemplatePermissionsResponse,
  WorkspaceTemplateResponse
} from './workspaceTemplateTypes'
import { WORKSPACE_TEMPLATE_SOURCE } from './workspaceTemplateTypes'

const NO_PERMISSIONS: WorkspaceTemplatePermissionsResponse = {
  'workspace_templates:view': false,
  'workspace_templates:create': false
}

const TOAST_DURATION_MS = 3000

function toTemplateInfo(template: WorkspaceTemplateResponse): EnhancedTemplate {
  const models = template.requirements.models.map((model) => model.name)
  const usesPartnerNodes = template.requirements.uses_partner_nodes
  return {
    name: template.id,
    title: template.title,
    description: template.description,
    mediaType: 'image',
    mediaSubtype: 'webp',
    thumbnailVariant:
      template.thumbnail_type === 'image_comparison'
        ? 'compareSlider'
        : undefined,
    isApp: template.requirements.is_app,
    models,
    openSource: !usesPartnerNodes,
    isPartnerNode: usesPartnerNodes,
    date: template.created_at,
    tags: [],
    sourceModule: WORKSPACE_TEMPLATE_SOURCE,
    searchableText: [template.title, template.description, ...models].join(' ')
  }
}

async function fetchOfficialWorkflow(
  name: string
): Promise<ComfyWorkflowJSON | null> {
  const response = await fetch(api.fileURL(`/templates/${name}.json`))
  if (!response.ok) return null
  const json: unknown = await response.json()
  return (await validateComfyWorkflow(json)) ?? null
}

function failureMessage(error: unknown): string {
  if (!(error instanceof MockWorkspaceTemplatesError))
    return t('workspaceTemplates.errors.unknown')
  switch (error.code) {
    case 'workspace_templates_unavailable':
      return t('workspaceTemplates.errors.workspace_templates_unavailable')
    case 'forbidden':
      return t('workspaceTemplates.errors.forbidden')
    case 'not_found':
      return t('workspaceTemplates.errors.not_found')
    case 'invalid_request':
      return t('workspaceTemplates.errors.invalid_request')
  }
}

export const useWorkspaceTemplatesStore = defineStore(
  'workspaceTemplates',
  () => {
    const teamWorkspaceStore = useTeamWorkspaceStore()
    const workflowTemplatesStore = useWorkflowTemplatesStore()
    const toast = useToast()
    let currentUser: ReturnType<typeof useCurrentUser> | undefined
    function viewer() {
      currentUser ??= useCurrentUser()
      const { resolvedUserInfo, userDisplayName, userEmail } = currentUser
      return {
        id: resolvedUserInfo.value?.id ?? 'anonymous',
        name:
          userDisplayName.value ??
          userEmail.value ??
          t('workspaceTemplates.you')
      }
    }

    const workspaceTemplatesApi = createMockWorkspaceTemplatesApi(() => ({
      workspaceId: teamWorkspaceStore.activeWorkspaceId,
      isTeamWorkspace: teamWorkspaceStore.activeWorkspace?.type === 'team',
      viewer,
      officialTemplate: (name) =>
        workflowTemplatesStore.enhancedTemplates.find(
          (template) =>
            template.name === name && template.sourceModule === 'default'
        ),
      officialThumbnailUrl: (template: TemplateInfo, index) =>
        api.fileURL(
          `/templates/${template.name}-${index}.${template.mediaSubtype}`
        ),
      fetchOfficialWorkflow
    }))

    const permissions =
      ref<WorkspaceTemplatePermissionsResponse>(NO_PERMISSIONS)
    const templates = ref<WorkspaceTemplateResponse[]>([])
    const isLoading = ref(false)

    const canViewWorkspaceTemplates = computed(
      () => permissions.value['workspace_templates:view']
    )
    const canAddWorkspaceTemplates = computed(
      () => permissions.value['workspace_templates:create']
    )
    const templateInfos = computed(() => templates.value.map(toTemplateInfo))

    function findTemplate(id: string) {
      return templates.value.find((template) => template.id === id)
    }

    async function refreshPermissions() {
      try {
        permissions.value = await workspaceTemplatesApi.getPermissions()
      } catch (error) {
        permissions.value = NO_PERMISSIONS
        reportError(error, {
          surface: 'workspace',
          errorType: 'workspace_templates_permissions'
        })
      }
    }

    async function refreshTemplates() {
      if (!canViewWorkspaceTemplates.value) {
        templates.value = []
        return
      }
      isLoading.value = true
      try {
        templates.value = await workspaceTemplatesApi.list()
      } catch (error) {
        templates.value = []
        toast.error(failureMessage(error), { duration: TOAST_DURATION_MS })
      } finally {
        isLoading.value = false
      }
    }

    async function addTemplate(
      body: CreateWorkspaceTemplateRequest
    ): Promise<boolean> {
      try {
        const created = await workspaceTemplatesApi.create(body)
        templates.value = [created, ...templates.value]
        toast.success(t('workspaceTemplates.added', { title: created.title }), {
          duration: TOAST_DURATION_MS
        })
        return true
      } catch (error) {
        toast.error(failureMessage(error), { duration: TOAST_DURATION_MS })
        return false
      }
    }

    async function updateTemplate(
      id: string,
      body: UpdateWorkspaceTemplateRequest
    ): Promise<boolean> {
      try {
        const updated = await workspaceTemplatesApi.update(id, body)
        templates.value = templates.value.map((template) =>
          template.id === id ? updated : template
        )
        toast.success(t('workspaceTemplates.saved'), {
          duration: TOAST_DURATION_MS
        })
        return true
      } catch (error) {
        toast.error(failureMessage(error), { duration: TOAST_DURATION_MS })
        return false
      }
    }

    async function deleteTemplate(id: string): Promise<boolean> {
      try {
        await workspaceTemplatesApi.remove(id)
        templates.value = templates.value.filter(
          (template) => template.id !== id
        )
        toast.success(t('workspaceTemplates.deleted'), {
          duration: TOAST_DURATION_MS
        })
        return true
      } catch (error) {
        toast.error(failureMessage(error), { duration: TOAST_DURATION_MS })
        return false
      }
    }

    async function openTemplate(id: string): Promise<boolean> {
      const template = findTemplate(id)
      if (!template) return false
      try {
        const workflow = await workspaceTemplatesApi.getWorkflow(id)
        if (!workflow) {
          toast.error(t('workspaceTemplates.errors.not_found'), {
            duration: TOAST_DURATION_MS
          })
          return false
        }
        await app.loadGraphData(workflow, true, true, template.title, {
          openSource: 'template'
        })
        return true
      } catch (error) {
        reportError(error, {
          surface: 'workspace',
          errorType: 'workspace_template_open'
        })
        toast.error(failureMessage(error), { duration: TOAST_DURATION_MS })
        return false
      }
    }

    watch(
      () => [
        teamWorkspaceStore.activeWorkspaceId,
        teamWorkspaceStore.activeWorkspace?.type
      ],
      async () => {
        templates.value = []
        await refreshPermissions()
      },
      { immediate: true }
    )

    return {
      canViewWorkspaceTemplates,
      canAddWorkspaceTemplates,
      templates,
      templateInfos,
      isLoading,
      findTemplate,
      refreshTemplates,
      addTemplate,
      updateTemplate,
      deleteTemplate,
      openTemplate
    }
  }
)
