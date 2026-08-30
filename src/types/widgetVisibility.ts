export interface WidgetVisibility {
  hidden: boolean
  hideInPanel: boolean
}

export function isLegacyHiddenWidgetType(type: string): boolean {
  const normalized = type.toLowerCase()
  return normalized.includes('hidden') || normalized.startsWith('tschide')
}

export function isLegacyWidgetHidingType(type: string): boolean {
  return (
    isLegacyHiddenWidgetType(type) ||
    type === 'converted-widget' ||
    type.startsWith('converted-widget:')
  )
}
