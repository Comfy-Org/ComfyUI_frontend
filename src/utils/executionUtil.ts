import type { LGraph } from '@comfyorg/litegraph'
import { LGraphEventMode } from '@comfyorg/litegraph'

import { isPrimitiveNode } from '@/nodes/PrimitiveNode'
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

  for (const outerNode of graph.computeExecutionOrder(false)) {
    const innerNodes = outerNode.getInnerNodes
      ? outerNode.getInnerNodes()
      : [outerNode]
    for (const node of innerNodes) {
      if (isPrimitiveNode(node)) {
        node.applyToGraph()
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
      if (node.isVirtualNode) {
        continue
      }

      if (
        node.mode === LGraphEventMode.NEVER ||
        node.mode === LGraphEventMode.BYPASS
      ) {
        // Don't serialize muted nodes
        continue
      }

      const inputs: ComfyApiWorkflow[string]['inputs'] = {}
      const widgets = node.widgets

      // Store all widget values
      if (widgets) {
        for (let i = 0; i < widgets.length; i++) {
          const widget = widgets[i]
          if (
            widget.name &&
            (!widget.options || widget.options.serialize !== false)
          ) {
            inputs[widget.name] = widget.serializeValue
              ? await widget.serializeValue(node, i)
              : widget.value
          }
        }
      }

      // Store all node links
      for (let i = 0; i < node.inputs.length; i++) {
        let parent = node.getInputNode(i)
        if (parent) {
          let link = node.getInputLink(i)
          while (
            parent.mode === LGraphEventMode.BYPASS ||
            parent.isVirtualNode
          ) {
            let found = false
            if (parent.isVirtualNode) {
              link = link ? parent.getInputLink(link.origin_slot) : null
              if (link) {
                parent = parent.getInputNode(link.target_slot)
                if (parent) {
                  found = true
                }
              }
            } else if (link && parent.mode === LGraphEventMode.BYPASS) {
              let all_inputs = [link.origin_slot]
              if (parent.inputs) {
                // @ts-expect-error convert list of strings to list of numbers
                all_inputs = all_inputs.concat(Object.keys(parent.inputs))
                for (let parent_input in all_inputs) {
                  // @ts-expect-error assign string to number
                  parent_input = all_inputs[parent_input]
                  if (
                    parent.inputs[parent_input]?.type === node.inputs[i].type
                  ) {
                    // @ts-expect-error convert string to number
                    link = parent.getInputLink(parent_input)
                    if (link) {
                      // @ts-expect-error convert string to number
                      parent = parent.getInputNode(parent_input)
                    }
                    found = true
                    break
                  }
                }
              }
            }

            if (!found) {
              break
            }
          }

          if (link) {
            if (parent?.updateLink) {
              link = parent.updateLink(link)
            }
            if (link) {
              inputs[node.inputs[i].name] = [
                String(link.origin_id),
                // @ts-expect-error link.origin_slot is already number.
                parseInt(link.origin_slot)
              ]
            }
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
  for (const o in output) {
    for (const i in output[o].inputs) {
      if (
        Array.isArray(output[o].inputs[i]) &&
        output[o].inputs[i].length === 2 &&
        !output[output[o].inputs[i][0]]
      ) {
        delete output[o].inputs[i]
      }
    }
  }

  // @ts-expect-error Convert ISerializedGraph to ComfyWorkflowJSON
  return { workflow: workflow as ComfyWorkflowJSON, output }
}
