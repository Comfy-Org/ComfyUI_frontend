import type { ComfyTemplateInputAsset } from '@comfyorg/comfyui-desktop-bridge-types'
import { computed, onScopeDispose, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { createToastId } from '@/types/toastId'
import { isCloud } from '@/platform/distribution/types'
import { isLocalDesktopHost } from '@/utils/envUtil'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useSurveyFeatureTracking } from '@/platform/surveys/useSurveyFeatureTracking'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { TemplateInput } from '@comfyorg/api-client/templateSchema'
import { syncCompletedTemplateInputsWithCurrentGraph } from '@/platform/workflow/templates/composables/useTemplateInputDownloadGraphSync'
import { useWorkflowTemplatesStore } from '@/platform/workflow/templates/repositories/workflowTemplatesStore'
import { usePartnerNodesEducationStore } from '@/platform/workflow/templates/stores/partnerNodesEducationStore'
import type {
  TemplateGroup,
  TemplateInfo,
  WorkflowTemplates
} from '@comfyorg/api-client/templateTypes'
import {
  getPendingTemplateSampleInputs,
  resolveTemplateInputAssets,
  startMissingTemplateInputDownloads
} from '@/platform/workflow/templates/utils/templateInputAssets'
import type {
  ComfyWorkflowJSON,
  LegacyLoadableWorkflow
} from '@comfyorg/graph-model/workflowSchema'
import {
  validateComfyWorkflow,
  zLegacyLoadableWorkflow
} from '@comfyorg/graph-model/workflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'

import { prepareTemplateInputs } from '@/platform/workflow/templates/services/templateInputService'

type TemplateLoadResult = 'loaded' | 'graph-failed' | 'not-started'

type FetchedTemplate =
  | { strict: true; json: ComfyWorkflowJSON }
  | { strict: false; json: LegacyLoadableWorkflow }

export type PreparedWorkflowTemplate = {
  id: string
  sourceModule: string
  workflowName: string
  controller: AbortController
  data: FetchedTemplate & {
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
    educationStore.retireCard()
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
    if (!isLocalDesktopHost() || sourceModule !== 'default') return

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
    useToast().error(t('g.error'), { description: detail })
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
    const toast = useToast()
    const progressToastId = createToastId()
    let preparedJson = workflow
    const errors: unknown[] = []
    try {
      const result = await prepareTemplateInputs(workflow, inputs, signal, {
        restoreNamed: useSettingStore().get(
          'Comfy.Workflow.NamedValuesRestore'
        ),
        onStart: () => {
          toast.loading(t('templateWorkflows.preparingMedia'), {
            id: progressToastId
          })
        }
      })
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
      toast.dismiss(progressToastId)
    }
    if (errors.length) {
      reportError(
        new AggregateError(errors, 'Template sample preparation failed'),
        {
          surface: 'graph',
          errorType: 'error_loading_template_media'
        }
      )
      toast.warning(t('g.warning'), {
        description: t('templateWorkflows.error.preparingMedia'),
        duration: 8000
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
    const template = workflowTemplatesStore.enhancedTemplates.find(
      (template) =>
        template.name === id && template.sourceModule === sourceModule
    )
    return { ...fetched, template }
  }

  async function loadTemplateGraph(
    {
      json,
      template
    }: Pick<PreparedWorkflowTemplate['data'], 'json' | 'template'>,
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

  async function prepareWorkflowTemplateInputs(
    data: PreparedWorkflowTemplate['data'],
    sourceModule: string,
    signal: AbortSignal,
    inputAssets: readonly ComfyTemplateInputAsset[]
  ) {
    const inputs = data.template?.io?.inputs
    if (
      isCloud ||
      sourceModule !== 'default' ||
      !data.strict ||
      !inputs?.length
    )
      return data

    return {
      ...data,
      json: await withPreparedSampleInputs(
        data.json,
        getPendingTemplateSampleInputs(inputs, inputAssets),
        signal
      )
    }
  }

  async function openPreparedWorkflowTemplate(
    prepared: PreparedWorkflowTemplate,
    {
      downloadAssets,
      inputAssets = []
    }: {
      downloadAssets?: boolean
      inputAssets?: readonly ComfyTemplateInputAsset[]
    } = {}
  ): Promise<TemplateLoadResult> {
    const { id, sourceModule, workflowName, controller, data } = prepared
    try {
      controller.signal.throwIfAborted()
      const shouldDownloadAssets = downloadAssets ?? !isLocalDesktopHost()
      const preparedData = shouldDownloadAssets
        ? await prepareWorkflowTemplateInputs(
            data,
            sourceModule,
            controller.signal,
            inputAssets
          )
        : data
      controller.signal.throwIfAborted()
      if (!workflowTemplatesStore.startTemplateGraphLoad(controller))
        return 'not-started'

      useTelemetry()?.trackTemplate({
        workflow_name: id,
        template_source: sourceModule
      })

      dialogStore.closeDialog()
      if (shouldDownloadAssets) startTemplateInputDownloads(id, sourceModule)
      return await loadTemplateGraph(preparedData, workflowName, sourceModule)
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
