import type { FieldValue, FormValues } from '../../config/workshop-playground'

function sameField(left: FieldValue, right: FieldValue): boolean {
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((file, index) => file === right[index])
    )
  return left === right
}

/**
 * Whether two records hold the same answers. Files count as the same only
 * when they are the same file, since two reads of one upload are two objects
 * and the page cannot tell their contents apart without reading them.
 */
export function sameFormValues(left: FormValues, right: FormValues): boolean {
  const names = new Set([...Object.keys(left), ...Object.keys(right)])
  return [...names].every((name) => sameField(left[name], right[name]))
}
