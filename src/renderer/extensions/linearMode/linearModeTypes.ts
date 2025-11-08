// @knipIgnore - Will be used by Linear Mode UI components
export type WidgetType =
  | 'text'
  | 'number'
  | 'slider'
  | 'combo'
  | 'toggle'
  | 'image'
  | 'color'

export interface PromotedWidget {
  nodeId: number
  widgetName: string
  displayName: string
  type: WidgetType
  config: WidgetConfig
  tooltip?: string
  group?: string
}

// @knipIgnore - Will be used by Linear Mode UI components
export interface WidgetConfig {
  multiline?: boolean
  placeholder?: string
  maxLength?: number
  min?: number
  max?: number
  step?: number
  default?: number
  randomizable?: boolean
  options?: string[] | number[]
  onLabel?: string
  offLabel?: string
}

export interface LinearModeTemplate {
  id: string
  name: string
  templatePath: string
  promotedWidgets: PromotedWidget[]
  description?: string
  tags?: string[]
}

export interface OutputImage {
  filename: string
  subfolder: string
  type: string
  prompt_id: string
}
