export const NONE_COMBO_OPTION = '(none)'

/** Whether COMBO values, as an array or a record keyed by option, declare the literal `(none)` option. */
export function declaresNoneOption(values: unknown): boolean {
  if (Array.isArray(values)) return values.includes(NONE_COMBO_OPTION)
  return (
    typeof values === 'object' &&
    values !== null &&
    Object.hasOwn(values, NONE_COMBO_OPTION)
  )
}
