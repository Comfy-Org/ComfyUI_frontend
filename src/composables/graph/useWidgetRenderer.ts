/**
 * Widget renderer composable for Vue node system
 * Maps LiteGraph widget types to Vue components
 */
import {
  WidgetType,
  widgetTypeToComponent
} from '@/components/graph/vueWidgets/widgetRegistry'

export const useWidgetRenderer = () => {
  /**
   * Map LiteGraph widget types to Vue widget component names
   */
  const getWidgetComponent = (widgetType: string): string => {
    // Map common LiteGraph widget types to our registry enum keys
    const typeToEnum: Record<string, string> = {
      // Number inputs
      number: WidgetType.NUMBER,
      slider: WidgetType.SLIDER,
      INT: WidgetType.INT,
      FLOAT: WidgetType.FLOAT,

      // Text inputs
      text: WidgetType.STRING,
      string: WidgetType.STRING,
      STRING: WidgetType.STRING,

      // Selection
      combo: WidgetType.COMBO,
      COMBO: WidgetType.COMBO,

      // Boolean
      toggle: WidgetType.TOGGLESWITCH,
      boolean: WidgetType.BOOLEAN,
      BOOLEAN: WidgetType.BOOLEAN,

      // Multiline text
      multiline: WidgetType.TEXTAREA,
      textarea: WidgetType.TEXTAREA,

      // Advanced widgets
      color: WidgetType.COLOR,
      COLOR: WidgetType.COLOR,
      image: WidgetType.IMAGE,
      IMAGE: WidgetType.IMAGE,
      file: WidgetType.FILEUPLOAD,
      FILEUPLOAD: WidgetType.FILEUPLOAD
    }

    // Get mapped enum key
    const enumKey = typeToEnum[widgetType]

    // Check if we have a component for this type
    if (enumKey && widgetTypeToComponent[enumKey]) {
      return enumKey
    }

    // Log unmapped widget types for debugging
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[useWidgetRenderer] Unknown widget type: ${widgetType}, falling back to WidgetInputText`
      )
    }

    return WidgetType.STRING // Return enum key for WidgetInputText
  }

  /**
   * Check if a widget should be rendered as Vue component
   */
  const shouldRenderAsVue = (widget: {
    type?: string
    options?: Record<string, unknown>
  }): boolean => {
    // Skip widgets that are marked as canvas-only
    if (widget.options?.canvasOnly) return false

    // Skip widgets without a type
    if (!widget.type) return false

    // Get the component type for this widget
    const enumKey = getWidgetComponent(widget.type)

    // If we have a component in our registry, render it as Vue
    return widgetTypeToComponent[enumKey] !== undefined
  }

  return {
    getWidgetComponent,
    shouldRenderAsVue
  }
}
