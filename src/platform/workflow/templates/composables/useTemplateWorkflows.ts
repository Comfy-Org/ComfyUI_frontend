import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'

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
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useDialogStore } from '@/stores/dialogStore'

type TemplateLoadResult = 'loaded' | 'graph-failed' | 'not-started'

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
  let ownedLoadController: AbortController | undefined
  const loadingTemplateId = computed(
    () => workflowTemplatesStore.loadingTemplateId
  )
  onScopeDispose(() => {
    workflowTemplatesStore.cancelTemplateLoad(ownedLoadController)
  })

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
    return template?.sourceModule
  }

  function showTemplateError(detail: string) {
    useToastStore().add({ severity: 'error', summary: t('g.error'), detail })
  }

  function reportTemplateError(error: unknown) {
    reportError(error, { errorType: 'error_loading_template' })
    showTemplateError(t('templateWorkflows.error.loading'))
  }

  async function loadTemplateData(
    id: string,
    sourceModule: string,
    signal: AbortSignal
  ) {
    const json = await fetchTemplateJson(id, sourceModule, signal)
    signal.throwIfAborted()
    const template = workflowTemplatesStore.enhancedTemplates.find(
      (template) =>
        template.name === id && template.sourceModule === sourceModule
    )
    return { json, template }
  }

  async function loadTemplateGraph(
    { json, template }: Awaited<ReturnType<typeof loadTemplateData>>,
    workflowName: string
  ): Promise<TemplateLoadResult> {
    try {
      const loadedWorkflow = await app.loadGraphData(
        json,
        true,
        true,
        workflowName,
        { openSource: 'template' }
      )
      if (loadedWorkflow === false) return 'graph-failed'

      updateTemplateEducation(template?.isPartnerNode, loadedWorkflow)
      return 'loaded'
    } catch (error) {
      reportTemplateError(error)
      return 'graph-failed'
    }
  }

  async function loadWorkflowTemplate(
    id: string,
    sourceModule: string
  ): Promise<TemplateLoadResult> {
    if (!isTemplatesLoaded.value) {
      showTemplateError(t('templateWorkflows.error.loading'))
      return 'not-started'
    }
    const controller = workflowTemplatesStore.startTemplateLoad(id)
    if (!controller) return 'not-started'
    ownedLoadController = controller
    try {
      const source = resolveTemplateSource(id, sourceModule)
      if (!source) {
        showTemplateError(
          t('templateWorkflows.error.templateNotFound', { templateName: id })
        )
        return 'not-started'
      }
      const data = await loadTemplateData(id, source, controller.signal)
      controller.signal.throwIfAborted()
      if (!workflowTemplatesStore.startTemplateGraphLoad(controller))
        return 'not-started'

      const workflowName =
        source === 'default' ? t(`templateWorkflows.template.${id}`, id) : id
      useTelemetry()?.trackTemplate({
        workflow_name: id,
        template_source: source
      })

      dialogStore.closeDialog()
      return await loadTemplateGraph(data, workflowName)
    } catch (error) {
      if (!controller.signal.aborted) reportTemplateError(error)
      return 'not-started'
    } finally {
      workflowTemplatesStore.finishTemplateLoad(controller)
      if (ownedLoadController === controller) ownedLoadController = undefined
    }
  }

  /**
   * Fetches template JSON from the appropriate endpoint
   */
  async function fetchTemplateJson(
    id: string,
    sourceModule: string,
    signal: AbortSignal
  ) {
    if (sourceModule === 'default') {
      // Default templates provided by frontend are served on this separate endpoint
      return fetch(api.fileURL(`/templates/${id}.json`), { signal }).then((r) =>
        r.json()
      )
    } else {
      return fetch(
        api.apiURL(`/workflow_templates/${sourceModule}/${id}.json`),
        { signal }
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
