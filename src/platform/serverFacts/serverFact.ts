declare const serverFactField: unique symbol

/**
 * A server fact as received, tagged with the API field that answered it. It
 * reads as the plain value, but a gate typed as one rejects anything mixed in
 * by `||`, `&&`, `!` or a ternary. See ADR-API-SERVER-FACTS-0042.
 */
export type ServerFact<Field extends string, T = boolean> = T & {
  readonly [serverFactField]: Field
}

/**
 * A `true` literal types as always truthy, so `fact || local` would collapse to
 * `fact` and pass the gate.
 */
export type FactValue<T> = T extends boolean ? boolean : T

/**
 * The only constructor. Call it where a response is decoded or in a local
 * provider for a non-cloud build, never at a gate.
 */
export function receiveServerFact<Field extends string, T>(
  _field: Field,
  value: T
): ServerFact<Field, FactValue<T>> {
  return value as ServerFact<Field, FactValue<T>>
}

/** Local transient UI state may withhold a fact, never grant it. */
export function narrowServerFact<Field extends string>(
  fact: ServerFact<Field>,
  localAllows: boolean
): ServerFact<Field> {
  return localAllows ? fact : (false as ServerFact<Field>)
}
