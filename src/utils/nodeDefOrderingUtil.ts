import { ComfyNodeDef } from '@/schemas/nodeDefSchema'

/**
 * Sorts the inputs of a node definition according to the input_order property.
 * If input_order is not provided, returns inputs unchanged (maintains backward compatibility).
 *
 * @param nodeDef - The node definition containing inputs and potentially input_order
 * @returns A new object with sorted inputs, or the original if no sorting needed
 */
export function sortNodeInputsByOrder(nodeDef: ComfyNodeDef): ComfyNodeDef {
  // If no input_order or no inputs, return as-is
  if (!nodeDef.input_order || !nodeDef.input) {
    return nodeDef
  }

  const sortedNodeDef = { ...nodeDef }

  // Sort each input category (required, optional, hidden)
  if (sortedNodeDef.input) {
    sortedNodeDef.input = { ...sortedNodeDef.input }

    // Process each category that has an order defined
    for (const category of ['required', 'optional', 'hidden'] as const) {
      const order = nodeDef.input_order[category]
      const inputs = sortedNodeDef.input[category]

      if (order && inputs) {
        // Create a new sorted object based on the order
        const sortedInputs: Record<string, any> = {}

        // First, add inputs in the specified order
        for (const inputName of order) {
          if (inputName in inputs) {
            sortedInputs[inputName] = inputs[inputName]
          }
        }

        // Then add any remaining inputs not in the order (for safety)
        for (const [inputName, inputSpec] of Object.entries(inputs)) {
          if (!(inputName in sortedInputs)) {
            sortedInputs[inputName] = inputSpec
          }
        }

        sortedNodeDef.input[category] = sortedInputs
      }
    }
  }

  return sortedNodeDef
}

/**
 * Gets an ordered array of input names for a given category.
 * Uses input_order if available, otherwise returns Object.keys() order.
 *
 * @param nodeDef - The node definition
 * @param category - The input category ('required', 'optional', or 'hidden')
 * @returns Array of input names in the correct order
 */
export function getOrderedInputNames(
  nodeDef: ComfyNodeDef,
  category: 'required' | 'optional' | 'hidden'
): string[] {
  const inputs = nodeDef.input?.[category]
  if (!inputs) return []

  // Use input_order if available
  const order = nodeDef.input_order?.[category]
  if (order) {
    // Filter to only include inputs that actually exist
    const existingInputs = order.filter((name) => name in inputs)

    // Add any inputs not in the order (shouldn't happen, but for safety)
    const remainingInputs = Object.keys(inputs).filter(
      (name) => !order.includes(name)
    )

    return [...existingInputs, ...remainingInputs]
  }

  // Fallback to Object.keys order
  return Object.keys(inputs)
}

/**
 * Reorders widget values based on the input_order to match expected widget order.
 * This is used when widgets were created in a different order than input_order specifies.
 *
 * @param widgetValues - The current widget values array
 * @param currentWidgetOrder - The current order of widget names
 * @param inputOrder - The desired order from input_order
 * @returns Reordered widget values array
 */
export function sortWidgetValuesByInputOrder(
  widgetValues: any[],
  currentWidgetOrder: string[],
  inputOrder: string[]
): any[] {
  if (!inputOrder || inputOrder.length === 0) {
    return widgetValues
  }

  // Create a map of widget name to value
  const valueMap = new Map<string, any>()
  currentWidgetOrder.forEach((name, index) => {
    if (index < widgetValues.length) {
      valueMap.set(name, widgetValues[index])
    }
  })

  // Reorder based on input_order
  const reordered: any[] = []
  const usedNames = new Set<string>()

  // First, add values in the order specified by input_order
  for (const name of inputOrder) {
    if (valueMap.has(name)) {
      reordered.push(valueMap.get(name))
      usedNames.add(name)
    }
  }

  // Then add any remaining values not in input_order
  for (const [name, value] of valueMap.entries()) {
    if (!usedNames.has(name)) {
      reordered.push(value)
    }
  }

  // If there are extra values not in the map, append them
  if (widgetValues.length > currentWidgetOrder.length) {
    for (let i = currentWidgetOrder.length; i < widgetValues.length; i++) {
      reordered.push(widgetValues[i])
    }
  }

  return reordered
}
