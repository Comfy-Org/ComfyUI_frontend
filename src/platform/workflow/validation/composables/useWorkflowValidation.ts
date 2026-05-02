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

import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

interface ValidationResult {
  graphData: ComfyWorkflowJSON | null
}

const TOPOLOGY_TOAST_LIMIT = 5

function summariseTopologyErrors(errors: TopologyError[]): string {
  const lines = errors.slice(0, TOPOLOGY_TOAST_LIMIT).map(describeTopologyError)
  if (errors.length > TOPOLOGY_TOAST_LIMIT) {
    lines.push(
      `…and ${errors.length - TOPOLOGY_TOAST_LIMIT} more (see console for full list)`
    )
  }
  return lines.join('\n')
}

export function useWorkflowValidation() {
  const toastStore = useToastStore()

  function reportTopology(errors: TopologyError[], silent: boolean) {
    if (silent || errors.length === 0) return
    for (const e of errors) console.warn('[topology]', describeTopologyError(e))
    toastStore.add({
      severity: 'warn',
      summary: `Workflow has ${errors.length} invalid link${errors.length === 1 ? '' : 's'}`,
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
          summary: 'Workflow Validation',
          detail: logs.join('\n')
        })
      }
      if (linkValidation.fixed && !silent) {
        toastStore.add({
          severity: 'success',
          summary: 'Workflow Links Fixed',
          detail: `Fixed ${linkValidation.patched} node connections and removed ${linkValidation.deleted} invalid links.`
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
            summary: 'Workflow has unrepairable invalid links',
            detail: err.message,
            life: 15_000
          })
        }
        console.error('[linkFixer aborted]', err.topologyError, err)
      } else {
        console.error(err)
      }
      return { graph: graphData, aborted: true }
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
