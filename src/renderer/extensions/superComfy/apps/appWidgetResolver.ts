import type { InputSpec as InputSpecV2 } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'

export interface ResolvedAppWidget {
  nodeType: string
  mode: 'always' | 'other'
  linked: boolean
  label: string
  value: unknown
  spec: InputSpecV2 | undefined
}

export interface ResolvedAppOutput {
  nodeId: string
  nodeType: string
  label: string
  inputTypes: string[]
}

export interface AppWidgetResolver {
  widget(nodeId: string, widgetName: string): ResolvedAppWidget | null
  output(nodeId: string): ResolvedAppOutput | null
}
