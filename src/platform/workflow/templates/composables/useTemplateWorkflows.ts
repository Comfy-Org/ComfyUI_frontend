import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { syncCompletedTemplateInputsWithCurrentGraph } from '@/platform/workflow/templates/composables/useTemplateInputDownloadGraphSync'
import type {
  TemplateGroup,
  TemplateInfo,
  WorkflowTemplates
} from '@/platform/workflow/templates/types/template'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useDialogStore } from '@/stores/dialogStore'

export type PreparedWorkflowTemplate = {
  id: string
  sourceModule: string
  workflowName: string
  workflow: ComfyWorkflowJSON
}

export function useTemplateWorkflows() {
  const { t } = useI18n()
  const workflowTemplatesStore = useWorkflowTemplatesStore()
  const dialogStore = useDialogStore()

  // State
  const selectedTemplate = ref<WorkflowTemplates | null>(null)
  const loadingTemplateId = ref<string | null>(null)

  // Computed
  const isTemplatesLoaded = computed(() => workflowTemplatesStore.isLoaded)
  const allTemplateGroups = computed<TemplateGroup[]>(
    () => workflowTemplatesStore.groupedTemplates
  )

  /**
   * Loads all template workflows from the API
   */
  const loadTemplates = async () => {
    if (!workflowTemplatesStore.isLoaded) {
      await workflowTemplatesStore.loadWorkflowTemplates()
    }
    return workflowTemplatesStore.isLoaded
  }

  /**
   * Selects the first template category as default
   */
  const selectFirstTemplateCategory = () => {
    if (allTemplateGroups.value.length > 0) {
      const firstCategory = allTemplateGroups.value[0].modules[0]
      selectTemplateCategory(firstCategory)
    }
  }

  /**
   * Selects a template category
   */
  const selectTemplateCategory = (category: WorkflowTemplates | null) => {
    selectedTemplate.value = category
    return category !== null
  }

  /**
   * Gets template thumbnail URL
   */
  const getTemplateThumbnailUrl = (
    template: TemplateInfo,
    sourceModule: string,
    index = '1'
  ) => {
    const basePath =
      sourceModule === 'default'
        ? api.fileURL(`/templates/${template.name}`)
        : api.apiURL(`/workflow_templates/${sourceModule}/${template.name}`)

    const indexSuffix = sourceModule === 'default' && index ? `-${index}` : ''
    return `${basePath}${indexSuffix}.${template.mediaSubtype}`
  }

  /**
   * Gets formatted template title
   */
  const getTemplateTitle = (template: TemplateInfo, sourceModule: string) => {
    const fallback =
      template.title ?? template.name ?? `${sourceModule} Template`
    return sourceModule === 'default'
      ? (template.localizedTitle ?? fallback)
      : fallback
  }

  /**
   * Gets formatted template description
   */
  const getTemplateDescription = (template: TemplateInfo) => {
    return (
      (template.localizedDescription || template.description)
        ?.replace(/[-_]/g, ' ')
        .trim() ?? ''
    )
  }

  const prepareWorkflowTemplate = async (
    id: string,
    sourceModule: string
  ): Promise<PreparedWorkflowTemplate | null> => {
    if (!isTemplatesLoaded.value) return null

    const resolvedSourceModule =
      sourceModule === 'all'
        ? allTemplateGroups.value
            .find(
              (group) =>
                group.label ===
                t(
                  'templateWorkflows.category.ComfyUI Examples',
                  'ComfyUI Examples'
                )
            )
            ?.modules.find((module) => module.moduleName === 'all')
            ?.templates.find((template) => template.name === id)?.sourceModule
        : sourceModule
    if (!resolvedSourceModule) return null

    const workflow: ComfyWorkflowJSON = await fetchTemplateJson(
      id,
      resolvedSourceModule
    )

    return {
      id,
      sourceModule: resolvedSourceModule,
      workflowName:
        resolvedSourceModule === 'default'
          ? t(`templateWorkflows.template.${id}`, id)
          : id,
      workflow
    }
  }

  const openPreparedWorkflowTemplate = async (
    prepared: PreparedWorkflowTemplate,
    { closeDialog = true }: { closeDialog?: boolean } = {}
  ) => {
    try {
      const { id, sourceModule, workflow, workflowName } = prepared

      useTelemetry()?.trackTemplate({
        workflow_name: id,
        template_source: sourceModule
      })

      if (closeDialog) dialogStore.closeDialog()
      await app.loadGraphData(workflow, true, true, workflowName, {
        openSource: 'template'
      })
      await syncCompletedTemplateInputsWithCurrentGraph()

      return true
    } catch (error) {
      console.error('Error loading workflow template:', error)
      return false
    }
  }

  /**
   * Loads a workflow template
   */
  const loadWorkflowTemplate = async (id: string, sourceModule: string) => {
    if (!isTemplatesLoaded.value) return false

    loadingTemplateId.value = id

    try {
      const prepared = await prepareWorkflowTemplate(id, sourceModule)
      if (!prepared) return false
      return await openPreparedWorkflowTemplate(prepared)
    } catch (error) {
      console.error('Error loading workflow template:', error)
      return false
    } finally {
      loadingTemplateId.value = null
    }
  }

  /**
   * Fetches template JSON from the appropriate endpoint
   */
  const fetchTemplateJson = async (id: string, sourceModule: string) => {
    const url =
      sourceModule === 'default'
        ? api.fileURL(`/templates/${id}.json`)
        : api.apiURL(`/workflow_templates/${sourceModule}/${id}.json`)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch workflow template (${response.status})`)
    }

    const workflow = await response.json()
    return (await validateComfyWorkflow(workflow)) ?? workflow
  }

  return {
    // State
    selectedTemplate,
    loadingTemplateId,

    // Computed
    isTemplatesLoaded,
    allTemplateGroups,

    // Methods
    loadTemplates,
    selectFirstTemplateCategory,
    selectTemplateCategory,
    getTemplateThumbnailUrl,
    getTemplateTitle,
    getTemplateDescription,
    prepareWorkflowTemplate,
    openPreparedWorkflowTemplate,
    loadWorkflowTemplate
  }
}
