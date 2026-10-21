export interface WidgetValueBinding {
  selector: string | RegExp
  value: string
}

export function matchesWidgetName(
  name: string,
  selector: string | RegExp
): boolean {
  return (
    name !== '' &&
    (typeof selector === 'string'
      ? name === selector
      : name.search(selector) !== -1)
  )
}
