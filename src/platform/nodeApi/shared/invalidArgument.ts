/** The error every member throws for an argument it cannot use. */
export function invalidArgument(
  member: string,
  needed: string,
  received: unknown
): TypeError {
  return new TypeError(
    `${member} needs ${needed}, not ${describeReceived(received)}.`
  )
}

function describeReceived(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`
  const isPrimitive =
    value === null || (typeof value !== 'object' && typeof value !== 'function')
  return isPrimitive ? String(value) : `a value of type ${typeof value}`
}
