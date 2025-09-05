/**
 * Widget renderer composable for Vue node system
 * Maps LiteGraph widget types to Vue components
 */
import { WidgetType, widgetTypeToComponent } from '../registry/widgetRegistry'

/**
 * Static mapping of LiteGraph widget types to Vue widget component names
 */
const TYPE_TO_ENUM_MAP: Record<string, string> = {
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
  selectbutton: WidgetType.SELECTBUTTON,
  SELECTBUTTON: WidgetType.SELECTBUTTON,
  multiselect: WidgetType.MULTISELECT,
  MULTISELECT: WidgetType.MULTISELECT,
  treeselect: WidgetType.TREESELECT,
  TREESELECT: WidgetType.TREESELECT,

  // Boolean
  toggle: WidgetType.TOGGLESWITCH,
  boolean: WidgetType.BOOLEAN,
  BOOLEAN: WidgetType.BOOLEAN,

  // Multiline text
  multiline: WidgetType.TEXTAREA,
  textarea: WidgetType.TEXTAREA,
  TEXTAREA: WidgetType.TEXTAREA,
  customtext: WidgetType.TEXTAREA,
  MARKDOWN: WidgetType.MARKDOWN,

  // Advanced widgets
  color: WidgetType.COLOR,
  COLOR: WidgetType.COLOR,
  imagecompare: WidgetType.IMAGECOMPARE,
  IMAGECOMPARE: WidgetType.IMAGECOMPARE,
  galleria: WidgetType.GALLERIA,
  GALLERIA: WidgetType.GALLERIA,
  file: WidgetType.FILEUPLOAD,
  fileupload: WidgetType.FILEUPLOAD,
  FILEUPLOAD: WidgetType.FILEUPLOAD,

  // Button widget
  button: WidgetType.BUTTON,
  BUTTON: WidgetType.BUTTON,

  // Chart widget
  chart: WidgetType.CHART,
  CHART: WidgetType.CHART
} as const

/**
 * Pre-computed widget support map for O(1) lookups
 * Maps widget type directly to boolean for fast shouldRenderAsVue checks
 */
const WIDGET_SUPPORT_MAP = new Map(
  Object.entries(TYPE_TO_ENUM_MAP).map(([type, enumValue]) => [
    type,
    widgetTypeToComponent[enumValue] !== undefined
  ])
)

export const ESSENTIAL_WIDGET_TYPES = new Set([
  'combo',
  'COMBO',
  'select',
  'toggle',
  'boolean',
  'BOOLEAN',
  'slider',
  'number',
  'INT',
  'FLOAT'
])

export const useWidgetRenderer = () => {
  const getWidgetComponent = (widgetType: string): string => {
    const enumKey = TYPE_TO_ENUM_MAP[widgetType]

    if (enumKey && widgetTypeToComponent[enumKey]) {
      return enumKey
    }

    return WidgetType.STRING
  }

  const shouldRenderAsVue = (widget: {
    type?: string
    options?: Record<string, unknown>
  }): boolean => {
    if (widget.options?.canvasOnly) return false
    if (!widget.type) return false

    // Check if widget type is explicitly supported
    const isSupported = WIDGET_SUPPORT_MAP.get(widget.type)
    if (isSupported !== undefined) return isSupported

    // Fallback: unknown types are rendered as STRING widget
    return widgetTypeToComponent[WidgetType.STRING] !== undefined
  }

  return {
    getWidgetComponent,
    shouldRenderAsVue
  }
}
