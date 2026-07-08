// Type-driven pairing generator for the connectivity (contract) tier.
// Wildcard `*` slots are excluded from pairing: LiteGraph.isValidConnection
// short-circuits on `*` before the real type compare, so a wildcard link
// proves reachability, not type interop.

export interface RawNodeDef {
  input?: {
    required?: Record<string, unknown>
    optional?: Record<string, unknown>
  }
  output?: unknown[]
  output_name?: string[]
  python_module?: string
}

interface NormalizedSlot {
  name: string
  type: string
  // COMBO slots: the literal option list, for same-vocabulary pairing.
  comboOptions?: unknown[]
}

export interface NormalizedNode {
  type: string
  pack: string
  inputs: NormalizedSlot[]
  outputs: NormalizedSlot[]
  // Slots whose raw spec carried no recognizable type (slotTypeOf null):
  // recorded so a schema change can never silently shrink the corpus.
  unknownSlots?: string[]
}

interface SlotRef {
  nodeType: string
  pack: string
  slotName: string
  slotType: string
}

export interface PlannedPair {
  producer: SlotRef
  consumer: SlotRef
}

export interface PairingPlan {
  pairs: PlannedPair[]
  // No compatible partner in the loaded corpus: a health signal, not a failure.
  orphans: Array<SlotRef & { dir: 'in' | 'out' }>
  // `*` / empty-typed slots, excluded by design (false confidence).
  wildcards: Array<SlotRef & { dir: 'in' | 'out' }>
  // COMBO slots with no same-vocabulary partner in the corpus, excluded:
  // isValidConnection only compares the string COMBO while each slot carries
  // its own option set, so pairing across different vocabularies proves
  // nothing (a checkpoint dropdown would "connect" to a scheduler dropdown).
  // Combos whose option lists match exactly ARE paired like any other type.
  combos: Array<SlotRef & { dir: 'in' | 'out' }>
  // Slots dropped at normalize time because their raw spec had no
  // recognizable type - surfaced here (and logged by the sweep) so a
  // backend or pack schema change cannot silently shrink the corpus.
  unknownShapes: string[]
}

// Extends the shared outcome taxonomy (runResult.ts); ORPHAN_TYPE is a
// plan-time skip so it never reaches the executor.
// WIDGET_ONLY_ON_INSTANCE: the pack's own frontend JS rebuilt a declared
// input as a widget-only control, so there is no socket to wire - excluded
// like wildcards, never a failure and never a silent pass.
export type ConnectivityOutcome =
  | 'PASS'
  | 'CONNECT_REJECTED'
  | 'ROUNDTRIP_LOST'
  | 'SLOT_CONTRACT_MISMATCH'
  | 'WIDGET_ONLY_ON_INSTANCE'

export function packOf(pythonModule: string | undefined): string {
  if (pythonModule?.startsWith('custom_nodes.'))
    return pythonModule.slice('custom_nodes.'.length)
  return 'core'
}

export function isWildcard(type: string): boolean {
  return type === '' || type === '*'
}

// COMBO list literals are arrays; their connectable socket type is COMBO.
function slotTypeOf(rawType: unknown): string | null {
  if (Array.isArray(rawType)) return 'COMBO'
  return typeof rawType === 'string' ? rawType : null
}

function inputSlots(
  entries: Record<string, unknown> | undefined,
  unknown: string[]
): NormalizedSlot[] {
  if (!entries) return []
  const slots: NormalizedSlot[] = []
  for (const [name, spec] of Object.entries(entries)) {
    const specArray = Array.isArray(spec) ? spec : [spec]
    const type = slotTypeOf(specArray[0])
    if (type === null) {
      unknown.push(name)
      continue
    }
    const opts = specArray[1] as
      | { socketless?: boolean; options?: unknown }
      | undefined
    // socketless = widget only, no slot: not connectable, out of the matrix.
    if (opts?.socketless) continue
    if (type === 'COMBO') {
      // Raw defs carry the option list as the type literal; the frontend's
      // transformed defs use the string 'COMBO' with options in the opts.
      const options = Array.isArray(specArray[0])
        ? (specArray[0] as unknown[])
        : Array.isArray(opts?.options)
          ? opts.options
          : undefined
      slots.push({ name, type, comboOptions: options })
      continue
    }
    slots.push({ name, type })
  }
  return slots
}

export function normalizeNodeDefs(
  defs: Record<string, RawNodeDef>
): NormalizedNode[] {
  return Object.entries(defs).map(([type, def]) => {
    const unknown: string[] = []
    const node: NormalizedNode = {
      type,
      pack: packOf(def.python_module),
      inputs: [
        ...inputSlots(def.input?.required, unknown),
        ...inputSlots(def.input?.optional, unknown)
      ],
      outputs: (def.output ?? []).flatMap((rawType, index) => {
        const slotType = slotTypeOf(rawType)
        if (slotType === null) {
          unknown.push(`output[${index}]`)
          return []
        }
        // output_name entries can be non-strings (COMBO literals repeat the
        // option array); the slot name must stay a string.
        const rawName = def.output_name?.[index]
        const slot: NormalizedSlot = {
          name: typeof rawName === 'string' ? rawName : slotType,
          type: slotType
        }
        if (slotType === 'COMBO') slot.comboOptions = rawType as unknown[]
        return [slot]
      })
    }
    if (unknown.length > 0) node.unknownSlots = unknown
    return node
  })
}

// Faithful mirror of LiteGraph.isValidConnection (LiteGraphGlobal.ts):
// wildcard/empty always match, comparison is case-insensitive, comma-unions
// match if any member pair matches. The live sweep still connects through the
// REAL validator, so any drift here surfaces as CONNECT_REJECTED, not a
// silent false green.
export function isTypeCompatible(a: string, b: string): boolean {
  if (isWildcard(a) || isWildcard(b)) return true
  const typeA = a.toLowerCase()
  const typeB = b.toLowerCase()
  if (typeA === typeB) return true
  if (!typeA.includes(',') && !typeB.includes(',')) return false
  return typeA
    .split(',')
    .some((memberA) =>
      typeB.split(',').some((memberB) => isTypeCompatible(memberA, memberB))
    )
}

function slotRef(node: NormalizedNode, slot: NormalizedSlot): SlotRef {
  return {
    nodeType: node.type,
    pack: node.pack,
    slotName: slot.name,
    slotType: slot.type
  }
}

// One representative compatible edge per slot, deterministically the first
// partner in (nodeType, slotName) order. This bounds cost to O(slots) but
// does NOT prove every pair; a full cross-product is an opt-in deep mode.
export function planPairs(
  all: NormalizedNode[],
  corpusTypes: string[]
): PairingPlan {
  const sorted = [...all].sort((a, b) => a.type.localeCompare(b.type))
  const pairable = (slot: NormalizedSlot) =>
    !isWildcard(slot.type) && slot.type !== 'COMBO'
  const producers: Array<SlotRef> = sorted.flatMap((node) =>
    node.outputs.filter(pairable).map((slot) => slotRef(node, slot))
  )
  const consumers: Array<SlotRef> = sorted.flatMap((node) =>
    node.inputs.filter(pairable).map((slot) => slotRef(node, slot))
  )
  // COMBO slots pair only on an identical option vocabulary; the string type
  // alone would let a checkpoint dropdown "connect" to a scheduler dropdown.
  // Vocabulary equality is a SET comparison: a wired input bypasses its own
  // widget, so menu order and the options[0] default do not participate in
  // the wire contract - only membership does (backend validation checks
  // "value in options"). Values still compare as exact strings.
  const vocabOf = (slot: NormalizedSlot) =>
    JSON.stringify(
      (slot.comboOptions ?? []).map((option) => JSON.stringify(option)).sort()
    )
  // A combo whose option list is unknown (transformed defs without an
  // options array) must never pair - a blind match would wire dropdowns
  // with no vocabulary evidence at all.
  const comboProducers = sorted.flatMap((node) =>
    node.outputs
      .filter(
        (slot) => slot.type === 'COMBO' && Array.isArray(slot.comboOptions)
      )
      .map((slot) => ({ ref: slotRef(node, slot), vocab: vocabOf(slot) }))
  )
  const comboConsumers = sorted.flatMap((node) =>
    node.inputs
      .filter(
        (slot) => slot.type === 'COMBO' && Array.isArray(slot.comboOptions)
      )
      .map((slot) => ({ ref: slotRef(node, slot), vocab: vocabOf(slot) }))
  )

  const plan: PairingPlan = {
    pairs: [],
    orphans: [],
    wildcards: [],
    combos: [],
    unknownShapes: all.flatMap((node) =>
      (node.unknownSlots ?? []).map((slot) => `${node.type}.${slot}`)
    )
  }
  const seen = new Set<string>()
  const addPair = (producer: SlotRef, consumer: SlotRef) => {
    const key = `${producer.nodeType}.${producer.slotName}->${consumer.nodeType}.${consumer.slotName}`
    if (seen.has(key)) return
    seen.add(key)
    plan.pairs.push({ producer, consumer })
  }

  const corpus = all.filter((node) => corpusTypes.includes(node.type))
  for (const node of corpus) {
    for (const slot of node.inputs) {
      if (isWildcard(slot.type)) {
        plan.wildcards.push({ ...slotRef(node, slot), dir: 'in' })
        continue
      }
      if (slot.type === 'COMBO') {
        const producer = Array.isArray(slot.comboOptions)
          ? comboProducers.find(
              (candidate) => candidate.vocab === vocabOf(slot)
            )
          : undefined
        if (producer) addPair(producer.ref, slotRef(node, slot))
        else plan.combos.push({ ...slotRef(node, slot), dir: 'in' })
        continue
      }
      const producer = producers.find((candidate) =>
        isTypeCompatible(candidate.slotType, slot.type)
      )
      if (producer) addPair(producer, slotRef(node, slot))
      else plan.orphans.push({ ...slotRef(node, slot), dir: 'in' })
    }
    for (const slot of node.outputs) {
      if (isWildcard(slot.type)) {
        plan.wildcards.push({ ...slotRef(node, slot), dir: 'out' })
        continue
      }
      if (slot.type === 'COMBO') {
        const consumer = Array.isArray(slot.comboOptions)
          ? comboConsumers.find(
              (candidate) => candidate.vocab === vocabOf(slot)
            )
          : undefined
        if (consumer) addPair(slotRef(node, slot), consumer.ref)
        else plan.combos.push({ ...slotRef(node, slot), dir: 'out' })
        continue
      }
      const consumer = consumers.find((candidate) =>
        isTypeCompatible(slot.type, candidate.slotType)
      )
      if (consumer) addPair(slotRef(node, slot), consumer)
      else plan.orphans.push({ ...slotRef(node, slot), dir: 'out' })
    }
  }
  return plan
}
