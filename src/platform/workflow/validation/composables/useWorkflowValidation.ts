import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toError } from '@/utils/errorUtil'
import { fixBadLinks } from '@/utils/linkFixer'

interface ValidationResult {
  graphData: ComfyWorkflowJSON | null
}

const MAX_REPORTS_PER_KIND = 25

/**
 * FNV-1a. The fixer's log lines interpolate node ids, which the schema leaves
 * unconstrained (`zNodeId` accepts any string), so they cannot be forwarded to
 * the sinks or pinned in memory verbatim. Digesting them keeps distinct
 * corruption distinguishable — for dedup, and for grouping in a dashboard —
 * without shipping workflow content anywhere.
 */
function digest(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

/**
 * Workflow loads re-enter validation on undo/redo, so without these a single
 * corrupt workflow would report once per history step. Keys must describe the
 * corruption itself, not just the workflow: `id` is optional in the schema, and
 * the workflows most likely to be corrupt are the legacy ones that lack it.
 *
 * The two kinds hold separate budgets so that a session full of repairable
 * corruption cannot crowd out the rarer report that the fixer itself broke.
 */
const reportedCorruption = new Set<string>()
const reportedFixerFailures = new Set<string>()

function reportOnce(key: string, seen: Set<string>, report: () => void): void {
  if (seen.has(key)) return
  if (seen.size >= MAX_REPORTS_PER_KIND) return
  seen.add(key)
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
    const corruptionDigest = digest(logs.join('\n'))

    if (patched || deleted) {
      reportOnce(
        [workflowId, patched, deleted, corruptionDigest].join('|'),
        reportedCorruption,
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
        const cause = toError(err).message
        reportOnce(`${workflowId}|${cause}`, reportedFixerFailures, () => {
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
