const INITIAL_CAPACITY = 1 << 10
const MAX_LOAD_FACTOR = 0.7

export interface TupleSet {
  readonly size: number
  add(a: number, b: number, c?: number): number
}

function hashTuple(a: number, b: number, c: number): number {
  const mixed =
    Math.imul(a, 0x9e3779b1) ^
    Math.imul(b, 0x85ebca6b) ^
    Math.imul(c, 0xc2b2ae35)
  const folded = Math.imul(mixed ^ (mixed >>> 15), 0x2c1b3c6d)
  return (folded ^ (folded >>> 12)) >>> 0
}

export function createTupleSet(width: 2 | 3): TupleSet {
  let capacity = INITIAL_CAPACITY
  let keys = new Uint32Array(capacity * width)
  let ordinals = new Uint32Array(capacity)
  let size = 0

  function holds(slot: number, a: number, b: number, c: number): boolean {
    const offset = slot * width
    return (
      keys[offset] === a &&
      keys[offset + 1] === b &&
      (width === 2 || keys[offset + 2] === c)
    )
  }

  function findSlot(a: number, b: number, c: number): number {
    const mask = capacity - 1
    let slot = hashTuple(a, b, c) & mask
    while (ordinals[slot] !== 0 && !holds(slot, a, b, c)) {
      slot = (slot + 1) & mask
    }
    return slot
  }

  function store(
    slot: number,
    a: number,
    b: number,
    c: number,
    ordinal: number
  ) {
    const offset = slot * width
    keys[offset] = a
    keys[offset + 1] = b
    if (width === 3) keys[offset + 2] = c
    ordinals[slot] = ordinal
  }

  function grow() {
    const previousKeys = keys
    const previousOrdinals = ordinals
    capacity *= 2
    keys = new Uint32Array(capacity * width)
    ordinals = new Uint32Array(capacity)
    for (let slot = 0; slot < previousOrdinals.length; slot++) {
      const ordinal = previousOrdinals[slot]
      if (ordinal === 0) continue
      const offset = slot * width
      const a = previousKeys[offset]
      const b = previousKeys[offset + 1]
      const c = width === 3 ? previousKeys[offset + 2] : 0
      store(findSlot(a, b, c), a, b, c, ordinal)
    }
  }

  return {
    get size() {
      return size
    },
    add(a, b, c = 0) {
      const third = width === 3 ? c : 0
      const existing = ordinals[findSlot(a, b, third)]
      if (existing !== 0) return existing - 1
      if (size + 1 > capacity * MAX_LOAD_FACTOR) grow()
      store(findSlot(a, b, third), a, b, third, size + 1)
      return size++
    }
  }
}
