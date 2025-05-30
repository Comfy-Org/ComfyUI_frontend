import type { ModelFile } from '@/schemas/comfyWorkflowSchema'

/**
 * Filters model metadata to only include models currently selected in the node's widget values.
 * This prevents false positives in the missing models dialog when outdated model metadata
 * exists but the actual selected models have changed.
 *
 * @param node - The workflow node to process
 * @returns Filtered array containing only models that are currently selected
 */
export function getSelectedModelsMetadata(node: {
  type: string
  widgets_values?: unknown[] | Record<string, unknown>
  properties?: { models?: ModelFile[] }
}): ModelFile[] {
  try {
    if (!node.properties?.models?.length) return []
    if (!node.widgets_values) return []

    const widgetValues = Array.isArray(node.widgets_values)
      ? node.widgets_values
      : Object.values(node.widgets_values)

    if (!widgetValues.length) return []

    // Create set of selected model names from widget values (only process combo inputs)
    const selectedModelNames = new Set<string>()
    for (const widgetValue of widgetValues) {
      if (typeof widgetValue === 'string' && widgetValue.trim()) {
        selectedModelNames.add(widgetValue)
      }
    }

    // Filter models to only include those currently selected
    return node.properties.models.filter((model) =>
      selectedModelNames.has(model.name)
    )
  } catch (error) {
    console.error('Error filtering models by current selection:', error)
    return []
  }
}
