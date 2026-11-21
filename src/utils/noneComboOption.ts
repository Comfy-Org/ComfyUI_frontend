export const NONE_COMBO_OPTION = '(none)'

/** Whether a COMBO declares the literal `(none)` option that nodes treat as an empty slot. */
export function declaresNoneOption(values: unknown): boolean {
  return Array.isArray(values) && values.includes(NONE_COMBO_OPTION)
}
