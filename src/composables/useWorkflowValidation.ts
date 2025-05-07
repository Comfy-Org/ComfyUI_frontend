import type { ISerialisedGraph } from '@comfyorg/litegraph/dist/types/serialisation'

import type { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import { validateComfyWorkflow } from '@/schemas/comfyWorkflowSchema'
import { useToastStore } from '@/stores/toastStore'
import { WorkflowLinkFixer } from '@/utils/linkFixer'

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
      const fixer = WorkflowLinkFixer.create(
        validatedGraphData as unknown as ISerialisedGraph
      )
      fixer.logger = {
        log: (...args: any[]) => {
          logs.push(...args)
        }
      }
      const checkBadLinksResult = fixer.check()

      if (!silent && checkBadLinksResult.hasBadLinks) {
        toastStore.add({
          severity: 'warn',
          summary: 'Workflow Validation',
          detail: logs.join('\n')
        })
      }

      const fixBadLinksResult = fixer.fix()
      if (!fixBadLinksResult.hasBadLinks && !silent) {
        toastStore.add({
          severity: 'success',
          summary: 'Workflow Links Fixed'
        })
        validatedData = fixBadLinksResult.graph as unknown as ComfyWorkflowJSON
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
