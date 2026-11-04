/**
 * `catch` binds `unknown`, so the `code` field an `fs` failure carries has to
 * be proven at runtime rather than asserted onto the value.
 */
export function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'EEXIST'
  )
}
