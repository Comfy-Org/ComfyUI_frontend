export interface WidgetAugmentationTarget {
  nodeType: string
  widgetName: string
}

type WidgetAugmentationSelector =
  | WidgetAugmentationTarget
  | ((widget: WidgetAugmentationTarget) => boolean)

export type PathSuggestion = {
  label: string
  value: string
  kind: 'directory' | 'file'
}

export type PathSuggestions =
  | { status: 'ready'; items: readonly PathSuggestion[] }
  | { status: 'unavailable' }

export type PathCompletion = {
  id: string
  target: WidgetAugmentationSelector
  kind: 'path-completion'
  suggest: (
    value: string,
    options: {
      signal: AbortSignal
      showAllFiles: boolean
      widget: WidgetAugmentationTarget
    }
  ) => Promise<PathSuggestions>
  parent: (value: string) => string
}

export type WidgetAugmentation = {
  id: string
  target: WidgetAugmentationSelector
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
  | PathCompletion
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

function isWidgetAugmentationSelector(
  target: unknown
): target is WidgetAugmentationSelector {
  return typeof target === 'function' || isWidgetAugmentationTarget(target)
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
    !isWidgetAugmentationSelector(value.target) ||
    !('kind' in value)
  )
    return false
  switch (value.kind) {
    case 'path-completion':
      return (
        'suggest' in value &&
        typeof value.suggest === 'function' &&
        'parent' in value &&
        typeof value.parent === 'function'
      )
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
