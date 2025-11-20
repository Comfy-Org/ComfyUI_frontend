import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type {
  IBaseWidget,
  TWidgetValue
} from '@/lib/litegraph/src/types/widgets'

interface PropagationOptions {
  /**
   * Find output by name instead of index
   */
  outputName?: string

  /**
   * Explicitly specify output index (default: 0)
   */
  outputIndex?: number

  /**
   * Whether to call node.setOutputData (default: false)
   */
  setOutputData?: boolean

  /**
   * Whether to update target widget values (default: true)
   */
  updateWidget?: boolean

  /**
   * Whether to call widget.callback after updating (default: false)
   */
  callWidgetCallback?: boolean

  /**
   * Whether to call targetNode.onExecuted (default: false)
   */
  callOnExecuted?: boolean

  /**
   * Custom function to build the message for onExecuted
   */
  messageBuilder?: (
    targetNode: LGraphNode,
    value: TWidgetValue,
    link: any
  ) => any

  /**
   * Custom handlers for specific node types
   * Return true if handled, false to continue with default behavior
   */
  customHandlers?: Map<
    string,
    (node: LGraphNode, value: TWidgetValue, link: any) => boolean
  >

  /**
   * Enable reentry protection (default: true)
   */
  preventReentry?: boolean
}

/**
 * Calculator function type for live preview nodes
 * Takes input values and returns the computed output value
 */
type LivePreviewCalculator = (inputValues: any[]) => TWidgetValue

/**
 * Configuration for setting up a live preview node
 */
interface LivePreviewNodeConfig {
  /**
   * The calculator function that computes output from inputs
   */
  calculator: LivePreviewCalculator

  /**
   * Optional output index (default: 0)
   */
  outputIndex?: number

  /**
   * Optional propagation options to use when propagating the result
   */
  propagationOptions?: Omit<PropagationOptions, 'outputIndex' | 'setOutputData'>
}

/**
 * Composable for managing live preview functionality in ComfyUI nodes
 *
 * @example
 * ```typescript
 * // In a node extension:
 * const { setupLivePreviewNode, propagateLivePreview } = useLivePreview()
 *
 * // For computation nodes:
 * setupLivePreviewNode(node, {
 *   calculator: (inputs) => {
 *     const [a, b] = inputs
 *     return a + b
 *   }
 * })
 *
 * // For simple propagation:
 * propagateLivePreview(node, value, {
 *   updateWidget: true,
 *   callOnExecuted: true
 * })
 * ```
 */
const propagationFlags = new WeakMap<LGraphNode, Set<string>>()
const nodeCalculators = new WeakMap<LGraphNode, LivePreviewNodeConfig>()

export function useLivePreview() {
  function getPropagationKey(outputIndex: number): string {
    return `propagating_${outputIndex}`
  }

  function isNodePropagating(node: LGraphNode, outputIndex: number): boolean {
    const flags = propagationFlags.get(node)
    return flags?.has(getPropagationKey(outputIndex)) ?? false
  }

  function setNodePropagating(
    node: LGraphNode,
    outputIndex: number,
    value: boolean
  ): void {
    if (!propagationFlags.has(node)) {
      propagationFlags.set(node, new Set())
    }
    const flags = propagationFlags.get(node)!
    const key = getPropagationKey(outputIndex)

    if (value) {
      flags.add(key)
    } else {
      flags.delete(key)
    }
  }

  function collectNodeInputValues(node: LGraphNode): any[] {
    const inputValues: any[] = []
    const graph = node.graph as LGraph

    if (!graph || !node.inputs) {
      return inputValues
    }

    for (const input of node.inputs) {
      if (input.link != null) {
        const link = graph.links[input.link]
        if (link) {
          const sourceNode = graph.getNodeById(link.origin_id)
          if (sourceNode && sourceNode.getOutputData) {
            const outputData = sourceNode.getOutputData(link.origin_slot)
            inputValues.push(outputData)
          } else {
            inputValues.push(undefined)
          }
        } else {
          inputValues.push(undefined)
        }
      } else if (input.widget) {
        const widget = node.widgets?.find((w) => w.name === input.widget?.name)
        inputValues.push(widget?.value)
      } else {
        inputValues.push(undefined)
      }
    }

    return inputValues
  }

  function triggerNodeRecalculation(node: LGraphNode): void {
    const config = nodeCalculators.get(node)
    if (!config) {
      return
    }

    const inputValues = collectNodeInputValues(node)

    const hasValidInputs = inputValues.some((v) => v !== undefined)
    if (!hasValidInputs) {
      return
    }

    try {
      const result = config.calculator(inputValues)
      if (result !== undefined) {
        propagateLivePreview(node, result, {
          outputIndex: config.outputIndex ?? 0,
          setOutputData: true,
          ...config.propagationOptions
        })
      }
    } catch (error) {
      console.error(
        `Error calculating live preview for node ${node.type}:`,
        error
      )
    }
  }

  function propagateLivePreview(
    sourceNode: LGraphNode,
    value: TWidgetValue,
    options: PropagationOptions = {}
  ): void {
    const {
      outputName,
      outputIndex: explicitOutputIndex,
      setOutputData = false,
      updateWidget = true,
      callWidgetCallback = false,
      callOnExecuted = false,
      messageBuilder,
      customHandlers,
      preventReentry = true
    } = options

    let outputIndex = explicitOutputIndex ?? 0

    if (outputName && sourceNode.outputs) {
      const foundIndex = sourceNode.outputs.findIndex(
        (output) => output.name === outputName
      )
      if (foundIndex >= 0) {
        outputIndex = foundIndex
      }
    }

    if (preventReentry && isNodePropagating(sourceNode, outputIndex)) {
      return
    }

    if (preventReentry) {
      setNodePropagating(sourceNode, outputIndex, true)
    }

    try {
      if (setOutputData && sourceNode.setOutputData && value !== undefined) {
        sourceNode.setOutputData(outputIndex, value as any)
      }

      const output = sourceNode.outputs?.[outputIndex]
      if (!output || !output.links || output.links.length === 0) {
        return
      }

      const graph = sourceNode.graph as LGraph
      if (!graph) {
        return
      }

      for (const linkId of output.links) {
        const link = graph.links[linkId]
        if (!link) {
          continue
        }

        const targetNode = graph.getNodeById(link.target_id)
        if (!targetNode) {
          continue
        }

        if (customHandlers?.has(targetNode.type)) {
          const handler = customHandlers.get(targetNode.type)!
          const handled = handler(targetNode, value, link)
          if (handled) {
            continue
          }
        }

        if (updateWidget) {
          const targetInput = targetNode.inputs?.[link.target_slot]
          if (targetInput?.widget) {
            const targetWidget = targetNode.widgets?.find(
              (w: IBaseWidget) => w.name === targetInput.widget?.name
            )

            if (targetWidget) {
              targetWidget.value = value

              if (callWidgetCallback && targetWidget.callback) {
                targetWidget.callback(value)
              }
            }
          }
        }

        const hasCalculator = nodeCalculators.has(targetNode)

        if (hasCalculator) {
          triggerNodeRecalculation(targetNode)
          continue
        }

        if (callOnExecuted && targetNode.onExecuted) {
          const message = messageBuilder
            ? messageBuilder(targetNode, value, link)
            : { text: [value] }

          targetNode.onExecuted(message)
        }
      }
    } finally {
      if (preventReentry) {
        setNodePropagating(sourceNode, outputIndex, false)
      }
    }
  }

  function setupLivePreviewNode(
    node: LGraphNode,
    config: LivePreviewNodeConfig
  ): void {
    nodeCalculators.set(node, config)

    const originalOnExecuted = node.onExecuted
    node.onExecuted = function (message: any) {
      if (originalOnExecuted) {
        originalOnExecuted.call(this, message)
      }

      if (message.text && Array.isArray(message.text)) {
        const result = config.calculator(message.text)
        if (result !== undefined) {
          propagateLivePreview(this, result, {
            outputIndex: config.outputIndex ?? 0,
            setOutputData: true,
            ...config.propagationOptions
          })
        }
      }
    }
  }

  return {
    propagateLivePreview,
    setupLivePreviewNode
  }
}
