const serials = new WeakMap<object, string>()
let lastSerial = 0

/** The id a slot keeps for as long as it is the same slot object. */
export function slotIdOf(slot: object): string {
  let id = serials.get(slot)
  if (id === undefined) {
    id = `slot:${++lastSerial}`
    serials.set(slot, id)
  }
  return id
}

/** The id a slot already has, without giving it one. */
export function knownSlotId(slot: object): string | undefined {
  return serials.get(slot)
}
