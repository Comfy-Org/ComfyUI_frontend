import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { useTemplateWorkflows } from './useTemplateWorkflows'

/**
 * Composable for loading templates from URL query parameters
 *
 * Supports URLs like:
 * - /?template=flux_simple (loads with default source)
 * - /?template=flux_simple&source=custom (loads from custom source)
 *
 * Input validation:
 * - Template and source parameters must match: ^[a-zA-Z0-9_-]+$
 * - Invalid formats are rejected with console warnings
 */
export function useTemplateUrlLoader() {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()
  const toast = useToast()
  const templateWorkflows = useTemplateWorkflows()

  /**
   * Validates parameter format to prevent path traversal and injection attacks
   */
  const isValidParameter = (param: string): boolean => {
    return /^[a-zA-Z0-9_-]+$/.test(param)
  }

  /**
   * Removes template and source parameters from URL
   */
  const cleanupUrlParams = () => {
    const newQuery = { ...route.query }
    delete newQuery.template
    delete newQuery.source
    void router.replace({ query: newQuery })
  }

  /**
   * Loads template from URL query parameters if present
   * Handles errors internally and shows appropriate user feedback
   */
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

    try {
      await templateWorkflows.loadTemplates()

      const success = await templateWorkflows.loadWorkflowTemplate(
        templateParam,
        sourceParam
      )

      if (!success) {
        toast.add({
          severity: 'error',
          summary: t('g.error'),
          detail: t('templateWorkflows.error.templateNotFound', {
            templateName: templateParam
          }),
          life: 3000
        })
      }
    } catch (error) {
      console.error(
        '[useTemplateUrlLoader] Failed to load template from URL:',
        error
      )
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('g.errorLoadingTemplate'),
        life: 3000
      })
    } finally {
      cleanupUrlParams()
    }
  }

  return {
    loadTemplateFromUrl
  }
}
