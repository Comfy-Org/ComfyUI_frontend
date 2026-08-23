import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { getErrorMessage } from '@/utils/errorUtil'
import { fixBadLinks } from '@/utils/linkFixer'

interface ValidationResult {
  graphData: ComfyWorkflowJSON | null
}

const LOG_SAMPLE_LIMIT = 20

/**
 * Workflow loads re-enter validation on undo/redo, so without this a single
 * corrupt workflow would report once per history step. Keys must describe the
 * corruption itself, not just the workflow: `id` is optional in the schema, and
 * the workflows most likely to be corrupt are the legacy ones that lack it.
 */
const reportedCorruption = new Set<string>()

function reportOnce(key: string, report: () => void): void {
  if (reportedCorruption.has(key)) return
  reportedCorruption.add(key)
  report()
}

export function useWorkflowValidation() {
  const toastStore = useToastStore()

  function tryFixLinks(
    graphData: ComfyWorkflowJSON,
    options: { silent?: boolean } = {}
  ) {
    const { silent = false } = options

    // Collect all logs in an array
    const logs: string[] = []
    // Then validate and fix links if schema validation passed
    const linkValidation = fixBadLinks(graphData as ISerialisedGraph, {
      fix: true,
      logger: {
        log: (...args: unknown[]) => {
          logs.push(args.join(' '))
        }
      }
    })

    const { patched, deleted, hasBadLinks } = linkValidation
    const workflowId = graphData.id ?? 'unidentified'
    const logSample = logs.slice(0, LOG_SAMPLE_LIMIT)

    if (patched || deleted) {
      reportOnce([workflowId, patched, deleted, ...logSample].join('|'), () => {
        reportError(new Error('Workflow loaded with corrupt links'), {
          errorType: 'workflow_link_corruption',
          level: 'warning',
          tags: { unrepaired: hasBadLinks },
          context: {
            workflowId,
            patched,
            deleted,
            logSample,
            logCount: logs.length
          }
        })
      })
    }

    if (!silent && logs.length > 0) {
      toastStore.add({
        severity: 'warn',
        summary: 'Workflow Validation',
        detail: logs.join('\n')
      })
    }

    // If links were fixed, notify the user
    if (linkValidation.fixed) {
      if (!silent) {
        toastStore.add({
          severity: 'success',
          summary: 'Workflow Links Fixed',
          detail: `Fixed ${linkValidation.patched} node connections and removed ${linkValidation.deleted} invalid links.`
        })
      }
    }

    return linkValidation.graph
  }

  /**
   * Validates a workflow, including link validation and schema validation
   */
  async function validateWorkflow(
    graphData: ComfyWorkflowJSON,
    options: {
      silent?: boolean
    } = {}
  ): Promise<ValidationResult> {
    const { silent = false } = options

    let validatedData: ComfyWorkflowJSON | null = null

    // First do schema validation
    const validatedGraphData = await validateComfyWorkflow(
      graphData,
      /* onError=*/ (err) => {
        if (!silent) {
          toastStore.addAlert(err)
        }
      }
    )

    if (validatedGraphData) {
      try {
        validatedData = tryFixLinks(validatedGraphData, {
          silent
        }) as ComfyWorkflowJSON
      } catch (err) {
        // Link fixer itself is throwing an error
        console.error(err)
        const workflowId = graphData.id ?? 'unidentified'
        reportOnce(
          `fixer-failure|${workflowId}|${getErrorMessage(err)}`,
          () => {
            reportError(err, {
              errorType: 'workflow_link_fixer_failure',
              context: { workflowId }
            })
          }
        )
      }
    }

    return {
      graphData: validatedData
    }
  }

  return {
    validateWorkflow
  }
}
