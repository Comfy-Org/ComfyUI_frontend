const refusals = new WeakSet<TypeError>()

/** The error every member throws for an argument it cannot use. */
export function invalidArgument(
  member: string,
  needed: string,
  received: unknown
): TypeError {
  const refusal = new TypeError(
    `${member} needs ${needed}, not ${describeReceived(received)}.`
  )
  refusals.add(refusal)
  return refusal
}

/** True for an error `invalidArgument` made, and for no other. */
export function isInvalidArgument(error: unknown): boolean {
  return error instanceof TypeError && refusals.has(error)
}

function describeReceived(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`
  const isPrimitive =
    value === null || (typeof value !== 'object' && typeof value !== 'function')
  return isPrimitive ? String(value) : `a value of type ${typeof value}`
}
