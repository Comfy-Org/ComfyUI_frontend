import {
  describeTopologyError,
  LinkRepairAbortedError,
  repairLinks,
  validateLinkTopology
} from '@comfyorg/workflow-validation'
import type {
  SerialisedGraph,
  TopologyError
} from '@comfyorg/workflow-validation'
import { useI18n } from 'vue-i18n'

import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

interface ValidationResult {
  graphData: ComfyWorkflowJSON | null
}

const TOPOLOGY_TOAST_LIMIT = 5

export function useWorkflowValidation() {
  const toastStore = useToastStore()
  const { t } = useI18n()

  function summariseTopologyErrors(errors: TopologyError[]): string {
    const lines = errors
      .slice(0, TOPOLOGY_TOAST_LIMIT)
      .map(describeTopologyError)
    if (errors.length > TOPOLOGY_TOAST_LIMIT) {
      lines.push(
        t('validation.topology.overflow', {
          count: errors.length - TOPOLOGY_TOAST_LIMIT
        })
      )
    }
    return lines.join('\n')
  }

  function reportTopology(errors: TopologyError[], silent: boolean) {
    if (silent || errors.length === 0) return
    for (const e of errors) console.warn('[topology]', describeTopologyError(e))
    toastStore.add({
      severity: 'warn',
      summary: t('validation.topology.invalidLinks', errors.length, {
        named: { count: errors.length }
      }),
      detail: summariseTopologyErrors(errors),
      life: 10_000
    })
  }

  function tryFixLinks(
    graphData: ComfyWorkflowJSON,
    options: { silent?: boolean } = {}
  ): { graph: ComfyWorkflowJSON; aborted: boolean } {
    const { silent = false } = options
    const topologyErrors = validateLinkTopology(graphData as SerialisedGraph)
    reportTopology(topologyErrors, silent)

    const logs: string[] = []
    try {
      const linkValidation = repairLinks(graphData as SerialisedGraph, {
        fix: true,
        silent,
        logger: {
          log: (...args: unknown[]) => logs.push(args.join(' '))
        }
      })

      if (!silent && logs.length > 0) {
        toastStore.add({
          severity: 'warn',
          summary: t('validation.topology.validationSummary'),
          detail: logs.join('\n')
        })
      }
      if (linkValidation.fixed && !silent) {
        toastStore.add({
          severity: 'success',
          summary: t('validation.topology.linksFixedSummary'),
          detail: t('validation.topology.linksFixedDetail', {
            patched: linkValidation.patched,
            deleted: linkValidation.deleted
          })
        })
      }
      return {
        graph: linkValidation.graph as ComfyWorkflowJSON,
        aborted: false
      }
    } catch (err: unknown) {
      if (err instanceof LinkRepairAbortedError) {
        if (!silent) {
          toastStore.add({
            severity: 'error',
            summary: t('validation.topology.abortedSummary'),
            detail: err.message,
            life: 15_000
          })
        }
        console.error('[linkFixer aborted]', err.topologyError, err)
        return { graph: graphData, aborted: true }
      }
      console.error(err)
      throw err
    }
  }

  async function validateWorkflow(
    graphData: ComfyWorkflowJSON,
    options: {
      silent?: boolean
    } = {}
  ): Promise<ValidationResult> {
    const { silent = false } = options

    const validatedGraphData = await validateComfyWorkflow(graphData, (err) => {
      if (!silent) toastStore.addAlert(err)
    })

    if (!validatedGraphData) {
      return { graphData: null }
    }

    const { graph, aborted } = tryFixLinks(validatedGraphData, { silent })
    return { graphData: aborted ? null : graph }
  }

  return {
    validateWorkflow
  }
}
