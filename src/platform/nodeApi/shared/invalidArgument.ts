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

/** The error a member throws when it is called outside the time it can be: `<member> can only be called <when>.` */
export function callOutOfTurn(member: string, when: string): TypeError {
  const refusal = new TypeError(`${member} can only be called ${when}.`)
  refusals.add(refusal)
  return refusal
}

/** True for an error `invalidArgument` or `callOutOfTurn` made, and for no other. */
export function isInvalidArgument(error: unknown): boolean {
  return error instanceof TypeError && refusals.has(error)
}

const SHOWN_LENGTH = 80

function describeReceived(value: unknown): string {
  if (typeof value === 'string') return `'${shortened(value)}'`
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'function') return 'a function'
  if (typeof value !== 'object' || value === null) return String(value)
  try {
    return describeObject(value)
  } catch {
    return 'an object'
  }
}

function describeObject(value: object): string {
  if (Array.isArray(value)) return 'a list'
  const prototype: unknown = Object.getPrototypeOf(value)
  if (prototype === null || prototype === Object.prototype) return 'an object'
  const name: unknown = (value as { constructor?: { name?: unknown } })
    .constructor?.name
  return typeof name === 'string' && name !== '' && name !== 'Object'
    ? `an instance of ${shortened(name)}`
    : 'an object'
}

function shortened(text: string): string {
  return text.length > SHOWN_LENGTH
    ? `${text.slice(0, SHOWN_LENGTH - 1)}…`
    : text
}
