import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { isCloud, isDesktop } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSurveyFeatureTracking } from '@/platform/surveys/useSurveyFeatureTracking'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { TemplateInput } from '@/platform/workflow/templates/schemas/templateSchema'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { syncCompletedTemplateInputsWithCurrentGraph } from '@/platform/workflow/templates/composables/useTemplateInputDownloadGraphSync'
import { usePartnerNodesEducationStore } from '@/platform/workflow/templates/stores/partnerNodesEducationStore'
import type {
  TemplateGroup,
  TemplateInfo,
  WorkflowTemplates
} from '@/platform/workflow/templates/types/template'
import {
  resolveTemplateInputAssets,
  startMissingTemplateInputDownloads
} from '@/platform/workflow/templates/utils/templateInputAssets'
import type {
  ComfyWorkflowJSON,
  LegacyLoadableWorkflow
} from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  validateComfyWorkflow,
  zLegacyLoadableWorkflow
} from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'

import { prepareTemplateInputs } from '../services/templateInputService'

type TemplateLoadResult = 'loaded' | 'graph-failed' | 'not-started'

export type PreparedWorkflowTemplate = {
  id: string
  sourceModule: string
  workflowName: string
  controller: AbortController
  data: {
    json: ComfyWorkflowJSON | LegacyLoadableWorkflow
    template:
      | ReturnType<
          typeof useWorkflowTemplatesStore
        >['enhancedTemplates'][number]
      | undefined
  }
}

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
  const { trackFeatureUsed } = useSurveyFeatureTracking('example-workflows')

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

  function startTemplateInputDownloads(id: string, sourceModule: string) {
    if (!isDesktop || sourceModule !== 'default') return

    void resolveTemplateInputAssets(id, () => window.__comfyDesktop2).then(
      (assets) => {
        startMissingTemplateInputDownloads(id, assets, {
          getBridge: () => window.__comfyDesktop2,
          reportError: (error) => {
            reportError(error, {
              surface: 'graph',
              errorType: 'workflow_template_input_download_failed',
              level: 'warning'
            })
          }
        })
      }
    )
  }

  function releasePreparedLoad(controller: AbortController) {
    workflowTemplatesStore.finishTemplateLoad(controller)
    if (ownedLoadController === controller) ownedLoadController = undefined
  }

  function showTemplateError(detail: string) {
    useToastStore().add({ severity: 'error', summary: t('g.error'), detail })
  }

  function reportTemplateError(error: unknown) {
    reportError(error, {
      surface: 'graph',
      errorType: 'error_loading_template'
    })
    showTemplateError(t('templateWorkflows.error.loading'))
  }

  async function withPreparedSampleInputs(
    workflow: ComfyWorkflowJSON,
    inputs: TemplateInput[],
    signal: AbortSignal
  ) {
    const toast = useToastStore()
    const progress = {
      severity: 'info' as const,
      summary: t('templateWorkflows.preparingMedia')
    }
    let preparedJson: ComfyWorkflowJSON | LegacyLoadableWorkflow = workflow
    const errors: unknown[] = []
    try {
      const result = await prepareTemplateInputs(
        workflow,
        inputs,
        signal,
        useSettingStore().get('Comfy.Workflow.NamedValuesRestore'),
        () => {
          toast.add(progress)
        }
      )
      errors.push(...result.errors)
      preparedJson = result.workflow
      if (result.uploadedCount > 0) {
        await useAssetsStore().inputAssets.invalidate()
        await app.reloadNodeDefs()
      }
      signal.throwIfAborted()
    } catch (error) {
      signal.throwIfAborted()
      errors.push(error)
    } finally {
      toast.remove(progress)
    }
    if (errors.length) {
      reportError(
        new AggregateError(errors, 'Template sample preparation failed'),
        {
          surface: 'graph',
          errorType: 'error_loading_template_media'
        }
      )
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('templateWorkflows.error.preparingMedia'),
        life: 8000
      })
    }
    return preparedJson
  }

  async function loadTemplateData(
    id: string,
    sourceModule: string,
    signal: AbortSignal
  ) {
    const fetched = await fetchTemplateJson(id, sourceModule, signal)
    signal.throwIfAborted()
    if (!fetched) return null
    const { json } = fetched

    const template = workflowTemplatesStore.enhancedTemplates.find(
      (template) =>
        template.name === id && template.sourceModule === sourceModule
    )
    const inputs = template?.io?.inputs
    if (isCloud || sourceModule !== 'default' || !inputs?.length)
      return { json, template }

    return {
      json: fetched.strict
        ? await withPreparedSampleInputs(fetched.json, inputs, signal)
        : json,
      template
    }
  }

  async function loadTemplateGraph(
    {
      json,
      template
    }: NonNullable<Awaited<ReturnType<typeof loadTemplateData>>>,
    workflowName: string,
    sourceModule: string
  ): Promise<TemplateLoadResult> {
    try {
      const loadedWorkflow = await app.loadGraphData(
        json as ComfyWorkflowJSON,
        true,
        true,
        workflowName,
        { openSource: 'template' }
      )
      if (loadedWorkflow === false) return 'graph-failed'
      if (loadedWorkflow === undefined) return 'not-started'

      updateTemplateEducation(template?.isPartnerNode, loadedWorkflow)
      await syncCompletedTemplateInputsWithCurrentGraph()
      if (sourceModule === 'default') trackFeatureUsed()
      return 'loaded'
    } catch (error) {
      reportTemplateError(error)
      return 'graph-failed'
    }
  }

  async function resolveTemplatePayload(
    id: string,
    sourceModule: string,
    signal: AbortSignal
  ) {
    const source = resolveTemplateSource(id, sourceModule)
    if (!source) {
      showTemplateError(
        t('templateWorkflows.error.templateNotFound', { templateName: id })
      )
      return null
    }
    const data = await loadTemplateData(id, source, signal)
    signal.throwIfAborted()
    if (!data) {
      showTemplateError(t('templateWorkflows.error.loading'))
      return null
    }
    return { source, data }
  }

  async function prepareWorkflowTemplate(
    id: string,
    sourceModule: string
  ): Promise<PreparedWorkflowTemplate | null> {
    if (!isTemplatesLoaded.value) {
      showTemplateError(t('templateWorkflows.error.loading'))
      return null
    }
    const controller = workflowTemplatesStore.startTemplateLoad(id)
    if (!controller) return null
    ownedLoadController = controller
    try {
      const payload = await resolveTemplatePayload(
        id,
        sourceModule,
        controller.signal
      )
      if (!payload) {
        releasePreparedLoad(controller)
        return null
      }
      return {
        id,
        sourceModule: payload.source,
        workflowName:
          payload.source === 'default'
            ? t(`templateWorkflows.template.${id}`, id)
            : id,
        controller,
        data: payload.data
      }
    } catch (error) {
      if (!controller.signal.aborted) reportTemplateError(error)
      releasePreparedLoad(controller)
      return null
    }
  }

  async function openPreparedWorkflowTemplate(
    prepared: PreparedWorkflowTemplate
  ): Promise<TemplateLoadResult> {
    const { id, sourceModule, workflowName, controller, data } = prepared
    try {
      if (!workflowTemplatesStore.startTemplateGraphLoad(controller))
        return 'not-started'

      useTelemetry()?.trackTemplate({
        workflow_name: id,
        template_source: sourceModule
      })

      dialogStore.closeDialog()
      startTemplateInputDownloads(id, sourceModule)
      return await loadTemplateGraph(data, workflowName, sourceModule)
    } catch (error) {
      if (!controller.signal.aborted) reportTemplateError(error)
      return 'not-started'
    } finally {
      releasePreparedLoad(controller)
    }
  }

  function discardPreparedWorkflowTemplate(
    prepared: PreparedWorkflowTemplate | null
  ) {
    if (!prepared) return
    workflowTemplatesStore.cancelTemplateLoad(prepared.controller)
    if (ownedLoadController === prepared.controller)
      ownedLoadController = undefined
  }

  async function loadWorkflowTemplate(
    id: string,
    sourceModule: string
  ): Promise<TemplateLoadResult> {
    const prepared = await prepareWorkflowTemplate(id, sourceModule)
    if (!prepared) return 'not-started'
    return openPreparedWorkflowTemplate(prepared)
  }

  /**
   * Fetches template JSON from the appropriate endpoint
   */
  /**
   * The payload plus whether strict validation accepted it. Sample-input
   * preparation needs a strictly valid workflow, and carrying the answer out
   * of here keeps it from parsing the same payload a second time - which also
   * reported the schema warning twice for a legacy template.
   */
  type FetchedTemplate =
    | { strict: true; json: ComfyWorkflowJSON }
    | { strict: false; json: LegacyLoadableWorkflow }

  async function fetchTemplateJson(
    id: string,
    sourceModule: string,
    signal: AbortSignal
  ): Promise<FetchedTemplate | null> {
    // Default templates provided by frontend are served on this separate endpoint
    const url =
      sourceModule === 'default'
        ? api.fileURL(`/templates/${id}.json`)
        : api.apiURL(`/workflow_templates/${sourceModule}/${id}.json`)

    const response = await fetch(url, { signal })
    if (!response.ok) {
      reportError(`Failed to fetch workflow template ${id}`, {
        surface: 'graph',
        errorType: 'error_fetching_workflow_template'
      })
      return null
    }

    const json: unknown = await response.json()
    let schemaMismatch: string | undefined
    const validated = await validateComfyWorkflow(json, (detail) => {
      schemaMismatch = detail
    })
    if (validated) return { strict: true, json: validated }

    const legacy = zLegacyLoadableWorkflow.safeParse(json)
    if (!legacy.success) {
      reportError(`Workflow template ${id} is not a loadable workflow`, {
        surface: 'graph',
        errorType: 'error_validating_workflow_template'
      })
      return null
    }
    if (schemaMismatch) {
      reportError(new Error(schemaMismatch), {
        surface: 'graph',
        errorType: 'error_validating_workflow_template_schema',
        level: 'warning'
      })
    }
    return { strict: false, json: legacy.data }
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
    discardPreparedWorkflowTemplate,
    loadWorkflowTemplate
  }
}
