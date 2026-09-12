import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { reportError } from '@/platform/telemetry/reportError'
import { createOnceReporter } from '@/platform/telemetry/reportOnce'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toError } from '@/utils/errorUtil'
import { fnv1aHex } from '@/utils/hashUtil'
import { fixBadLinks } from '@/utils/linkFixer'

interface ValidationResult {
  graphData: ComfyWorkflowJSON | null
}

export const MAX_REPORTS_PER_KIND = 25

/**
 * DQ-18: per-corruption-shape dedup (2026-08-25). Keys describe the corruption
 * itself so identical shapes report once per session, regardless of workflow.
 *
 * The two kinds hold separate budgets so that a session full of repairable
 * corruption cannot crowd out the rarer report that the fixer itself broke.
 */
const reportCorruptionOnce = createOnceReporter(MAX_REPORTS_PER_KIND)
const reportFixerFailureOnce = createOnceReporter(MAX_REPORTS_PER_KIND)

export function useWorkflowValidation() {
  const toastStore = useToastStore()

  function tryFixLinks(
    graphData: ComfyWorkflowJSON,
    options: { silent?: boolean } = {}
  ) {
    const { silent = false } = options

    // Collect all logs in an array
    const logs: string[] = []
    // Then validate and fix links if schema validation passed. The fixer keeps
    // logging even when validation is silenced, because the report below is
    // derived from these lines; the toasts are what `silent` suppresses.
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
    // The fixer's log lines interpolate node ids, which the schema leaves
    // unconstrained (`zNodeId` accepts any string), so the text itself must not
    // reach the sinks or be pinned in memory. The digest distinguishes one
    // corruption from another — it is a key, not an anonymiser.
    const corruptionDigest = fnv1aHex(logs.join('\n'))

    if (patched || deleted) {
      reportCorruptionOnce(
        [patched, deleted, corruptionDigest].join('|'),
        () => {
          reportError(new Error('Workflow loaded with corrupt links'), {
            errorType: 'workflow_link_corruption',
            level: 'warning',
            tags: { unrepaired: hasBadLinks },
            context: {
              workflowId,
              patched,
              deleted,
              corruptionDigest,
              logCount: logs.length
            }
          })
        }
      )
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
        // Unlike the log above, this message reaches the sinks verbatim, so
        // throw sites in the fixer must keep interpolating nothing.
        const cause = toError(err).message
        reportFixerFailureOnce(`${workflowId}|${cause}`, () => {
          reportError(err, {
            errorType: 'workflow_link_fixer_failure',
            context: { workflowId }
          })
        })
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
