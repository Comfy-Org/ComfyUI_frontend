export interface WidgetAugmentationTarget {
  nodeType: string
  widgetName: string
}

export type WidgetAugmentation = {
  id: string
  target: WidgetAugmentationTarget
} & (
  | {
      kind: 'text-completion'
      suggest: (query: string) => readonly string[]
    }
  | {
      kind: 'hint'
      text: (value: string) => string
    }
  | {
      kind: 'text-action'
      label: string
      transform: (value: string) => string
    }
)
