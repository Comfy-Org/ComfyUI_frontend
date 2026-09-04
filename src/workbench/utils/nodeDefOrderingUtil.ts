import type { TWidgetValue } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

/**
 * Gets an ordered array of InputSpec objects based on input_order.
 * This is designed to work with V2 format used by litegraphService.
 *
 * @param nodeDefImpl - The ComfyNodeDefImpl containing both V1 and V2 formats
 * @param inputs - The V2 format inputs (flat Record<string, InputSpec>)
 * @returns Array of InputSpec objects in the correct order
 */
export function getOrderedInputSpecs(
  nodeDefImpl: ComfyNodeDefImpl,
  inputs: Partial<Record<string, InputSpec>>
): InputSpec[] {
  const orderedInputSpecs: InputSpec[] = []

  // If no input_order, return default Object.values order
  if (!nodeDefImpl.input_order) {
    return Object.values(inputs).filter((input) => input !== undefined)
  }

  // Process required inputs in specified order
  const requiredOrder = Object.hasOwn(nodeDefImpl.input_order, 'required')
    ? nodeDefImpl.input_order.required
    : []
  for (const name of requiredOrder) {
    const inputSpec = inputs[name]
    if (inputSpec && !inputSpec.isOptional) {
      orderedInputSpecs.push(inputSpec)
    }
  }

  // Process optional inputs in specified order
  const optionalOrder = Object.hasOwn(nodeDefImpl.input_order, 'optional')
    ? nodeDefImpl.input_order.optional
    : []
  for (const name of optionalOrder) {
    const inputSpec = inputs[name]
    if (inputSpec?.isOptional) {
      orderedInputSpecs.push(inputSpec)
    }
  }

  // Add any remaining inputs not specified in input_order
  const processedNames = new Set(orderedInputSpecs.map((spec) => spec.name))
  for (const inputSpec of Object.values(inputs)) {
    if (inputSpec && !processedNames.has(inputSpec.name)) {
      orderedInputSpecs.push(inputSpec)
    }
  }

  return orderedInputSpecs
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
  widgetValues: TWidgetValue[],
  currentWidgetOrder: string[],
  inputOrder: string[]
): TWidgetValue[] {
  if (inputOrder.length === 0) {
    return widgetValues
  }

  const widgetIndexByName = new Map<string, number>()
  currentWidgetOrder.forEach((name, index) => {
    if (index < widgetValues.length) {
      widgetIndexByName.set(name, index)
    }
  })

  // Reorder based on input_order
  const reordered: TWidgetValue[] = []
  const usedNames = new Set<string>()

  // First, add values in the order specified by input_order
  for (const name of inputOrder) {
    const index = widgetIndexByName.get(name)
    if (index === undefined) continue
    reordered.push(widgetValues[index])
    usedNames.add(name)
  }

  // Then add any remaining values not in input_order
  for (const [name, index] of widgetIndexByName) {
    if (!usedNames.has(name)) {
      reordered.push(widgetValues[index])
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
