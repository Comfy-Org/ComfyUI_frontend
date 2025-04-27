import type { ISerialisedGraph } from '@comfyorg/litegraph/dist/types/serialisation'

import type { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import { validateComfyWorkflow } from '@/schemas/comfyWorkflowSchema'
import { useToastStore } from '@/stores/toastStore'
import { fixBadLinks } from '@/utils/linkFixer'

export interface ValidationResult {
  graphData: ComfyWorkflowJSON | null
  linksFixes?: {
    patched: number
    deleted: number
  }
}

export function useWorkflowValidation() {
  const toastStore = useToastStore()

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

    let linksFixes
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
      // Collect all logs in an array
      const logs: string[] = []
      // Then validate and fix links if schema validation passed
      const linkValidation = fixBadLinks(
        validatedGraphData as unknown as ISerialisedGraph,
        {
          fix: true,
          silent,
          logger: {
            log: (message: string) => {
              logs.push(message)
            }
          }
        }
      )

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

      validatedData = linkValidation.graph as unknown as ComfyWorkflowJSON
      linksFixes = {
        patched: linkValidation.patched,
        deleted: linkValidation.deleted
      }
    }

    return {
      graphData: validatedData,
      linksFixes
    }
  }

  return {
    validateWorkflow
  }
}
