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

function isWidgetAugmentationTarget(
  target: unknown
): target is WidgetAugmentationTarget {
  return (
    typeof target === 'object' &&
    target !== null &&
    'nodeType' in target &&
    typeof target.nodeType === 'string' &&
    'widgetName' in target &&
    typeof target.widgetName === 'string'
  )
}

export function isWidgetAugmentation(
  value: unknown
): value is WidgetAugmentation {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('target' in value) ||
    !isWidgetAugmentationTarget(value.target) ||
    !('kind' in value)
  )
    return false
  switch (value.kind) {
    case 'text-completion':
      return 'suggest' in value && typeof value.suggest === 'function'
    case 'hint':
      return 'text' in value && typeof value.text === 'function'
    case 'text-action':
      return (
        'label' in value &&
        typeof value.label === 'string' &&
        'transform' in value &&
        typeof value.transform === 'function'
      )
    default:
      return false
  }
}
