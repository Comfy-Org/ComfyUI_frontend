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

  function tryFixLinks(
    graphData: ComfyWorkflowJSON,
    options: { silent?: boolean } = {}
  ): ComfyWorkflowJSON | null {
    const { silent = false } = options
    // Collect all logs in an array
    const logs: string[] = []
    // Then validate and fix links if schema validation passed
    const fixer = WorkflowLinkFixer.create(
      graphData as unknown as ISerialisedGraph
    )
    fixer.logger = {
      log: (...args: any[]) => {
        logs.push(...args)
      }
    }
    const checkBadLinksResult = fixer.check()
    // Graph has no bad links, so we can return it as is
    if (!checkBadLinksResult.hasBadLinks) {
      return graphData
    }

    if (!silent) {
      toastStore.add({
        severity: 'warn',
        summary: 'Workflow Validation',
        detail: logs.join('\n')
      })
    }

    const fixBadLinksResult = fixer.fix()
    if (!fixBadLinksResult.hasBadLinks) {
      if (!silent) {
        toastStore.add({
          severity: 'success',
          summary: 'Workflow Links Fixed'
        })
      }
      return fixBadLinksResult.graph as unknown as ComfyWorkflowJSON
    }
    return null
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
        validatedData = tryFixLinks(validatedGraphData, { silent })
      } catch (err) {
        // Link fixer itself is throwing an error. Log it and return the original graph
        console.error(err)
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
