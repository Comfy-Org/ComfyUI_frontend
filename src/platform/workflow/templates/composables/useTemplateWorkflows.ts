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

  /**
   * Loads a workflow template
   */
  const loadWorkflowTemplate = async (id: string, sourceModule: string) => {
    if (!isTemplatesLoaded.value) return false

    const controller = workflowTemplatesStore.startTemplateLoad()
    const request = { id, controller }
    pendingLoad.value = request
    const toast = useToastStore()
    const progress = {
      severity: 'info' as const,
      summary: t('templateWorkflows.preparingMedia')
    }
    let json

    try {
      // Handle "All" category as a special case
      if (sourceModule === 'all') {
        // Find "All" category in the ComfyUI Examples group
        const comfyExamplesGroup = allTemplateGroups.value.find(
          (g) =>
            g.label ===
            t('templateWorkflows.category.ComfyUI Examples', 'ComfyUI Examples')
        )
        const allCategory = comfyExamplesGroup?.modules.find(
          (m) => m.moduleName === 'all'
        )
        const template = allCategory?.templates.find((t) => t.name === id)

        if (!template || !template.sourceModule) {
          toast.add({
            severity: 'error',
            summary: t('g.error'),
            detail: t('templateWorkflows.error.templateNotFound', {
              templateName: id
            })
          })
          return false
        }

        // Use the stored source module for loading
        sourceModule = template.sourceModule
      }

      // Regular case for normal categories
      json = await fetchTemplateJson(id, sourceModule)
      controller.signal.throwIfAborted()

      const template = workflowTemplatesStore.enhancedTemplates.find(
        (tpl) => tpl.name === id && tpl.sourceModule === sourceModule
      )
      if (
        !isCloud &&
        sourceModule === 'default' &&
        template?.io?.inputs?.length
      ) {
        toast.add(progress)
        const workflow = await validateComfyWorkflow(json)
        if (!workflow) {
          toast.add({
            severity: 'error',
            summary: t('g.error'),
            detail: t('templateWorkflows.error.loading')
          })
          return false
        }
        const result = await prepareTemplateInputs(
          workflow,
          template.io.inputs,
          controller.signal
        )
        if (!result.ok) {
          reportError(result.error, {
            errorType: 'error_loading_template_media'
          })
          toast.add({
            severity: 'error',
            summary: t('g.error'),
            detail: t('templateWorkflows.error.preparingMedia')
          })
          return false
        }
        json = result.workflow
        if (json !== workflow) {
          await useAssetsStore().inputAssets.invalidate()
          await app.reloadNodeDefs()
        }
        controller.signal.throwIfAborted()
      }

      const workflowName =
        sourceModule === 'default'
          ? t(`templateWorkflows.template.${id}`, id)
          : id

      useTelemetry()?.trackTemplate({
        workflow_name: id,
        template_source: sourceModule
      })

      pendingLoad.value = null
      dialogStore.closeDialog()
      // Bind the card to the workflow THIS load activated, not the global
      // active one: asset scans keep loadGraphData pending, and the user can
      // switch workflows in that window.
      const loadedWorkflow = await app.loadGraphData(
        json,
        true,
        true,
        workflowName,
        { openSource: 'template' }
      )

      const educationStore = usePartnerNodesEducationStore()
      if (template?.isPartnerNode && typeof loadedWorkflow === 'object') {
        educationStore.requestCard(loadedWorkflow.key)
      } else {
        educationStore.dismissCard()
      }

      return true
    } catch (error) {
      if (controller.signal.aborted) return false
      reportError(error, { errorType: 'error_loading_template' })
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('templateWorkflows.error.loading')
      })
      return false
    } finally {
      toast.remove(progress)
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
