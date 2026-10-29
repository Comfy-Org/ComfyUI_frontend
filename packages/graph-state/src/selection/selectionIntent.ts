export type SelectionModifiers = Partial<
  Pick<MouseEvent, 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey'>
>

export type ClickSelectionIntent =
  | 'replace'
  | 'add'
  | 'remove'
  | 'clear'
  | 'none'

export type MarqueeSelectionIntent = 'replace' | 'add' | 'subtract'

export interface ClickSelectionContext {
  hasItem: boolean
  isSelected: boolean
  modifiers: SelectionModifiers | undefined
  multiSelect: boolean
  selectOnly: boolean
  sticky: boolean
}

function hasToggleModifier(modifiers: SelectionModifiers | undefined): boolean {
  return Boolean(
    modifiers?.shiftKey || modifiers?.ctrlKey || modifiers?.metaKey
  )
}

export function resolveClickSelection({
  hasItem,
  isSelected,
  modifiers,
  multiSelect,
  selectOnly,
  sticky
}: ClickSelectionContext): ClickSelectionIntent {
  const toggling = hasToggleModifier(modifiers)
  if (!hasItem) {
    if (selectOnly) return 'none'
    return !toggling || multiSelect ? 'clear' : 'none'
  }
  const modifying = toggling || multiSelect || selectOnly
  if (!isSelected) return modifying ? 'add' : 'replace'
  if (sticky) return 'none'
  return modifying ? 'remove' : 'replace'
}

export function resolveMarqueeSelection(
  modifiers: SelectionModifiers
): MarqueeSelectionIntent {
  if (modifiers.shiftKey) return 'add'
  if (modifiers.altKey) return 'subtract'
  return 'replace'
}

export function applyMarqueeSelection<T>(
  intent: MarqueeSelectionIntent,
  current: Iterable<T>,
  enclosed: ReadonlySet<T>
): Set<T> {
  switch (intent) {
    case 'add':
      return new Set([...current, ...enclosed])
    case 'subtract':
      return new Set([...current].filter((item) => !enclosed.has(item)))
    case 'replace':
      return new Set(enclosed)
  }
}
