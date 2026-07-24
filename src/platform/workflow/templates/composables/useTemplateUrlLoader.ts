import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useTelemetry } from '@/platform/telemetry'
import { TemplateOpenTrigger } from '@/platform/telemetry/types'
import { isTemplateOpenTrigger } from '@/platform/telemetry/utils/templateOpenTrigger'
// eslint-disable-next-line import-x/no-restricted-paths
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

import { useTemplateWorkflows } from './useTemplateWorkflows'

/**
 * Loads a template from URL query params, e.g.
 * `/?template=flux_simple&source=custom&mode=linear`. Untrusted params are
 * validated before use; invalid ones are rejected with a console warning.
 */
export function useTemplateUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const toast = useToast()
  const templateWorkflows = useTemplateWorkflows()
  const canvasStore = useCanvasStore()
  const TEMPLATE_NAMESPACE = PRESERVED_QUERY_NAMESPACES.TEMPLATE
  const SUPPORTED_MODES = ['linear'] as const
  type SupportedMode = (typeof SUPPORTED_MODES)[number]

  /** Guards params against traversal/injection before they reach a fetch path. */
  const isValidParameter = (param: string): boolean => {
    return /^[a-zA-Z0-9_.-]+$/.test(param) && !param.includes('..')
  }

  const isSupportedMode = (mode: string): mode is SupportedMode => {
    return SUPPORTED_MODES.includes(mode as SupportedMode)
  }

  /** A bare or unrecognized `?open_trigger=` means a shared link; explicit callers override. */
  const resolveOpenTrigger = (value: unknown): TemplateOpenTrigger => {
    return isTemplateOpenTrigger(value) ? value : TemplateOpenTrigger.SharedUrl
  }

  const cleanupUrlParams = () => {
    const newQuery = { ...route.query }
    delete newQuery.template
    delete newQuery.source
    delete newQuery.mode
    delete newQuery.open_trigger
    void router.replace({ query: newQuery })
  }

  /** No-op when no `?template=` is present; surfaces failures as a toast. */
  const loadTemplateFromUrl = async () => {
    const templateParam = route.query.template

    if (!templateParam || typeof templateParam !== 'string') {
      return
    }

    if (!isValidParameter(templateParam)) {
      console.warn(
        `[useTemplateUrlLoader] Invalid template parameter format: ${templateParam}`
      )
      return
    }

    const sourceParam = (route.query.source as string | undefined) || 'default'

    if (!isValidParameter(sourceParam)) {
      console.warn(
        `[useTemplateUrlLoader] Invalid source parameter format: ${sourceParam}`
      )
      return
    }

    const modeParam = route.query.mode as string | undefined

    if (
      modeParam &&
      (typeof modeParam !== 'string' || !isValidParameter(modeParam))
    ) {
      console.warn(
        `[useTemplateUrlLoader] Invalid mode parameter format: ${modeParam}`
      )
      return
    }

    if (modeParam && !isSupportedMode(modeParam)) {
      console.warn(
        `[useTemplateUrlLoader] Unsupported mode parameter: ${modeParam}. Supported modes: ${SUPPORTED_MODES.join(', ')}`
      )
    }

    const openTrigger = resolveOpenTrigger(route.query.open_trigger)

    try {
      await templateWorkflows.loadTemplates()

      const success = await templateWorkflows.loadWorkflowTemplate(
        templateParam,
        sourceParam,
        openTrigger
      )

      if (!success) {
        toast.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('templateWorkflows.error.templateNotFound', {
            templateName: templateParam
          })
        })
      } else if (modeParam === 'linear') {
        useTelemetry()?.trackEnterLinear({ source: 'template_url' })
        canvasStore.linearMode = true
      }
    } catch (error) {
      console.error(
        '[useTemplateUrlLoader] Failed to load template from URL:',
        error
      )
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('g.errorLoadingTemplate')
      })
    } finally {
      cleanupUrlParams()
      clearPreservedQuery(TEMPLATE_NAMESPACE)
    }
  }

  return {
    loadTemplateFromUrl
  }
}
