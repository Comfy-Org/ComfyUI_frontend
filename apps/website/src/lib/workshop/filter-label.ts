/**
 * What to call a filter control.
 *
 * A sheet with one group hides that group's name, so the control is the only
 * place a reader can learn what the filter narrows. With more than one there is
 * no single answer, and the generic name is the honest one.
 */
export function filterLabel(
  groups: readonly { readonly label: string }[],
  generic: string
): string {
  return groups.length === 1 ? groups[0].label : generic
}
