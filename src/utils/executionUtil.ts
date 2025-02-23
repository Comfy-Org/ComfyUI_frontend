import type { LGraph } from '@comfyorg/litegraph'
import { LGraphEventMode } from '@comfyorg/litegraph'

import type { ComfyApiWorkflow, ComfyWorkflowJSON } from '@/types/comfyWorkflow'

/**
 * Converts the current graph workflow for sending to the API.
 * Note: Node widgets are updated before serialization to prepare queueing.
 * @returns The workflow and node links
 */
export const graphToPrompt = async (
  graph: LGraph,
  options: { sortNodes?: boolean } = {}
): Promise<{ workflow: ComfyWorkflowJSON; output: ComfyApiWorkflow }> => {
  const { sortNodes = false } = options

  for (const node of graph.computeExecutionOrder(false)) {
    const innerNodes = node.getInnerNodes ? node.getInnerNodes() : [node]
    for (const innerNode of innerNodes) {
      // Don't serialize frontend only nodes but let them make changes
      if (innerNode.isVirtualNode) {
        innerNode.applyToGraph?.()
      }
    }
  }

  const workflow = graph.serialize({ sortNodes })

  // Remove localized_name from the workflow
  for (const node of workflow.nodes) {
    for (const slot of node.inputs ?? []) {
      delete slot.localized_name
    }
    for (const slot of node.outputs ?? []) {
      delete slot.localized_name
    }
  }

  const output: ComfyApiWorkflow = {}
  // Process nodes in order of execution
  for (const outerNode of graph.computeExecutionOrder(false)) {
    const skipNode =
      outerNode.mode === LGraphEventMode.NEVER ||
      outerNode.mode === LGraphEventMode.BYPASS
    const innerNodes =
      !skipNode && outerNode.getInnerNodes
        ? outerNode.getInnerNodes()
        : [outerNode]
    for (const node of innerNodes) {
      if (
        node.isVirtualNode ||
        // Don't serialize muted nodes
        node.mode === LGraphEventMode.NEVER ||
        node.mode === LGraphEventMode.BYPASS
      ) {
        continue
      }

      const inputs: ComfyApiWorkflow[string]['inputs'] = {}
      const { widgets } = node

      // Store all widget values
      if (widgets) {
        for (const [i, widget] of widgets.entries()) {
          if (!widget.name || widget.options?.serialize === false) continue

          inputs[widget.name] = widget.serializeValue
            ? await widget.serializeValue(node, i)
            : widget.value
        }
      }

      // Store all node links
      for (const [i, input] of node.inputs.entries()) {
        let parent = node.getInputNode(i)
        if (!parent) continue

        let link = node.getInputLink(i)
        while (parent.mode === LGraphEventMode.BYPASS || parent.isVirtualNode) {
          if (!link) break

          if (parent.isVirtualNode) {
            link = parent.getInputLink(link.origin_slot)
            if (!link) break

            parent = parent.getInputNode(link.target_slot)
            if (!parent) break
          } else if (!parent.inputs) {
            // Maintains existing behaviour if parent.getInputLink is overriden
            break
          } else if (parent.mode === LGraphEventMode.BYPASS) {
            // Bypass nodes by finding first input with matching type
            const parentInputIndexes = Object.keys(parent.inputs).map(Number)
            // Prioritise exact slot index
            const indexes = [link.origin_slot].concat(parentInputIndexes)

            const matchingIndex = indexes.find(
              (index) => parent.inputs[index]?.type === input.type
            )
            // No input types match
            if (matchingIndex === undefined) break

            link = parent.getInputLink(matchingIndex)
            if (link) parent = parent.getInputNode(matchingIndex)
          }
        }

        if (link) {
          if (parent?.updateLink) {
            // groupNode
            link = parent.updateLink(link)
          }
          if (link) {
            inputs[input.name] = [
              String(link.origin_id),
              // @ts-expect-error link.origin_slot is already number.
              parseInt(link.origin_slot)
            ]
          }
        }
      }

      output[String(node.id)] = {
        inputs,
        // TODO(huchenlei): Filter out all nodes that cannot be mapped to a
        // comfyClass.
        class_type: node.comfyClass!,
        // Ignored by the backend.
        _meta: {
          title: node.title
        }
      }
    }
  }

  // Remove inputs connected to removed nodes
  for (const { inputs } of Object.values(output)) {
    for (const [i, input] of Object.entries(inputs)) {
      if (Array.isArray(input) && input.length === 2 && !output[input[0]]) {
        delete inputs[i]
      }
    }
  }

  // @ts-expect-error Convert ISerializedGraph to ComfyWorkflowJSON
  return { workflow: workflow as ComfyWorkflowJSON, output }
}
