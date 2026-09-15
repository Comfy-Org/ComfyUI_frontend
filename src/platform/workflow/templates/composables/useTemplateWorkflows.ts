import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { usePartnerNodesEducationStore } from '@/platform/workflow/templates/stores/partnerNodesEducationStore'
import type {
  TemplateGroup,
  TemplateInfo,
  WorkflowTemplates
} from '@/platform/workflow/templates/types/template'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'

import { prepareTemplateInputs } from '../services/templateInputService'

function updateTemplateEducation(
  isPartnerNode: boolean | undefined,
  loadedWorkflow: Awaited<ReturnType<typeof app.loadGraphData>>
) {
  const educationStore = usePartnerNodesEducationStore()
  if (isPartnerNode && typeof loadedWorkflow === 'object') {
    educationStore.requestCard(loadedWorkflow.key)
  } else {
    educationStore.dismissCard()
  }
}

export function useTemplateWorkflows() {
  const { t } = useI18n()
  const workflowTemplatesStore = useWorkflowTemplatesStore()
  const dialogStore = useDialogStore()

  // State
  const selectedTemplate = ref<WorkflowTemplates | null>(null)
  const pendingLoad = shallowRef<{
    id: string
    controller: AbortController
  } | null>(null)
  const loadingTemplateId = computed(() => pendingLoad.value?.id ?? null)
  onScopeDispose(() => pendingLoad.value?.controller.abort())

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
    const fallback = template.title ?? template.name
    return sourceModule === 'default'
      ? (template.localizedTitle ?? fallback)
      : fallback
  }

  /**
   * Gets formatted template description
   */
  const getTemplateDescription = (template: TemplateInfo) => {
    return (template.localizedDescription || template.description)
      .replace(/[-_]/g, ' ')
      .trim()
  }

  function resolveTemplateSource(id: string, sourceModule: string) {
    if (sourceModule !== 'all') return sourceModule

    const group = allTemplateGroups.value.find(
      (group) =>
        group.label ===
        t('templateWorkflows.category.ComfyUI Examples', 'ComfyUI Examples')
    )
    const category = group?.modules.find(
      (module) => module.moduleName === 'all'
    )
    const template = category?.templates.find(
      (template) => template.name === id
    )
    if (template?.sourceModule) return template.sourceModule

    showTemplateError(
      t('templateWorkflows.error.templateNotFound', { templateName: id })
    )
  }

  function showTemplateError(detail: string) {
    useToastStore().add({ severity: 'error', summary: t('g.error'), detail })
  }

  async function loadTemplateData(
    id: string,
    sourceModule: string,
    signal: AbortSignal
  ) {
    const json = await fetchTemplateJson(id, sourceModule)
    signal.throwIfAborted()
    const template = workflowTemplatesStore.enhancedTemplates.find(
      (template) =>
        template.name === id && template.sourceModule === sourceModule
    )
    if (isCloud || sourceModule !== 'default' || !template?.io?.inputs?.length)
      return { json, template }

    const toast = useToastStore()
    const progress = {
      severity: 'info' as const,
      summary: t('templateWorkflows.preparingMedia')
    }
    toast.add(progress)
    try {
      const workflow = await validateComfyWorkflow(json)
      if (!workflow) return { json, template }
      const result = await prepareTemplateInputs(
        workflow,
        template.io.inputs,
        signal
      )
      if (!result.ok) {
        reportError(result.error, { errorType: 'error_loading_template_media' })
        showTemplateError(t('templateWorkflows.error.preparingMedia'))
        return null
      }
      if (result.workflow !== workflow) {
        await useAssetsStore().inputAssets.invalidate()
        await app.reloadNodeDefs()
      }
      signal.throwIfAborted()
      return { json: result.workflow, template }
    } finally {
      toast.remove(progress)
    }
  }

  async function loadWorkflowTemplate(id: string, sourceModule: string) {
    if (!isTemplatesLoaded.value) return false

    const controller = workflowTemplatesStore.startTemplateLoad()
    const request = { id, controller }
    pendingLoad.value = request
    try {
      const source = resolveTemplateSource(id, sourceModule)
      if (!source) return false
      const data = await loadTemplateData(id, source, controller.signal)
      if (!data) return false
      controller.signal.throwIfAborted()

      const workflowName =
        source === 'default' ? t(`templateWorkflows.template.${id}`, id) : id
      useTelemetry()?.trackTemplate({
        workflow_name: id,
        template_source: source
      })

      pendingLoad.value = null
      dialogStore.closeDialog()
      const loadedWorkflow = await app.loadGraphData(
        data.json,
        true,
        true,
        workflowName,
        { openSource: 'template' }
      )

      updateTemplateEducation(data.template?.isPartnerNode, loadedWorkflow)

      return true
    } catch (error) {
      if (controller.signal.aborted) return false
      reportError(error, { errorType: 'error_loading_template' })
      showTemplateError(t('templateWorkflows.error.loading'))
      return false
    } finally {
      if (pendingLoad.value === request) pendingLoad.value = null
    }
  }

  /**
   * Fetches template JSON from the appropriate endpoint
   */
  const fetchTemplateJson = async (id: string, sourceModule: string) => {
    if (sourceModule === 'default') {
      // Default templates provided by frontend are served on this separate endpoint
      return fetch(api.fileURL(`/templates/${id}.json`)).then((r) => r.json())
    } else {
      return fetch(
        api.apiURL(`/workflow_templates/${sourceModule}/${id}.json`)
      ).then((r) => r.json())
    }
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
    loadWorkflowTemplate
  }
}
