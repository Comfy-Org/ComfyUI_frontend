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
  // object_info repeats RETURN_TYPES here when a node declares no
  // RETURN_NAMES, so a combo output's entry is its option array.
  output_name?: unknown[]
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
  // Slots the corpus cannot address: no recognizable type (slotTypeOf null)
  // or no string name on the instance (outputSlotName null). Recorded so a
  // schema change can never silently shrink the corpus.
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
  requiredPairIssues: string[]
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
  // recognizable type or name. The sweep fails if this is non-empty.
  unknownShapes: string[]
}

// Extends the shared outcome taxonomy (runResult.ts); ORPHAN_TYPE is a
// plan-time skip so it never reaches the executor.
// WIDGET_ONLY_ON_INSTANCE: the pack's own frontend JS rebuilt a declared
// input as a widget-only control, so there is no socket to wire. The sweep
// fails unless applicability is made explicit at its call site.
export type ConnectivityOutcome =
  | 'PASS'
  | 'CONNECT_REJECTED'
  | 'DYNAMIC_SLOT_CLEANUP_STALLED'
  | 'ROUNDTRIP_LOST'
  | 'SLOT_CONTRACT_MISMATCH'
  | 'THREW'
  | 'WIDGET_ONLY_ON_INSTANCE'

export function packOf(pythonModule: string | undefined): string {
  if (pythonModule?.startsWith('custom_nodes.'))
    return pythonModule.slice('custom_nodes.'.length)
  return 'core'
}

function isWildcard(type: string): boolean {
  return type === '' || type === '*'
}

// COMBO list literals are arrays; their connectable socket type is COMBO.
function slotTypeOf(rawType: unknown): string | null {
  if (Array.isArray(rawType)) return 'COMBO'
  return typeof rawType === 'string' ? rawType : null
}

// Faithful mirror of production naming (schemas/nodeDef/migration.ts):
// `output_name[index] || output_<index>`, uncoerced - so a truthy non-string
// entry names the live slot something no string lookup can match (null here).
function outputSlotName(rawName: unknown, index: number): string | null {
  if (!rawName) return `output_${index}`
  return typeof rawName === 'string' ? rawName : null
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
        const name = outputSlotName(def.output_name?.[index], index)
        if (name === null) {
          unknown.push(`output[${index}].name`)
          return []
        }
        const slot: NormalizedSlot = { name, type: slotType }
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
  corpusTypes: string[],
  requiredPairKeys: string[] = [],
  knownNodeTypes: ReadonlySet<string> = new Set(all.map((node) => node.type))
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

  const corpus = all.filter((node) => corpusTypes.includes(node.type))
  const plan: PairingPlan = {
    pairs: [],
    requiredPairIssues: [],
    orphans: [],
    wildcards: [],
    combos: [],
    unknownShapes: corpus.flatMap((node) =>
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

  const corpusTypeSet = new Set(corpusTypes)
  for (const key of requiredPairKeys) {
    const sides = key.split(' -> ')
    if (sides.length !== 2) {
      plan.requiredPairIssues.push(`${key}: invalid pair key`)
      continue
    }
    const splitSide = (side: string) => {
      const separator = side.lastIndexOf('.')
      return separator > 0 && separator < side.length - 1
        ? [side.slice(0, separator), side.slice(separator + 1)]
        : null
    }
    const producerSide = splitSide(sides[0])
    const consumerSide = splitSide(sides[1])
    if (!producerSide || !consumerSide) {
      plan.requiredPairIssues.push(`${key}: invalid pair endpoint`)
      continue
    }
    const producerNode = all.find((node) => node.type === producerSide[0])
    const consumerNode = all.find((node) => node.type === consumerSide[0])
    const unknownEndpoints = [
      !producerNode ? producerSide[0] : null,
      !consumerNode ? consumerSide[0] : null
    ].filter(
      (nodeType): nodeType is string =>
        nodeType !== null && !knownNodeTypes.has(nodeType)
    )
    if (unknownEndpoints.length > 0) {
      plan.requiredPairIssues.push(
        `${key}: unknown node type(s): ${unknownEndpoints.join(', ')}`
      )
      continue
    }
    if (!producerNode || !consumerNode) continue
    if (
      !corpusTypeSet.has(producerNode.type) &&
      !corpusTypeSet.has(consumerNode.type)
    )
      continue
    const producerSlot = producerNode.outputs.find(
      (slot) => slot.name === producerSide[1]
    )
    const consumerSlot = consumerNode.inputs.find(
      (slot) => slot.name === consumerSide[1]
    )
    if (!producerSlot || !consumerSlot) {
      plan.requiredPairIssues.push(`${key}: declared slot is no longer present`)
      continue
    }
    const compatible =
      producerSlot.type === 'COMBO' || consumerSlot.type === 'COMBO'
        ? producerSlot.type === 'COMBO' &&
          consumerSlot.type === 'COMBO' &&
          Array.isArray(producerSlot.comboOptions) &&
          Array.isArray(consumerSlot.comboOptions) &&
          vocabOf(producerSlot) === vocabOf(consumerSlot)
        : isTypeCompatible(producerSlot.type, consumerSlot.type)
    if (!compatible) {
      plan.requiredPairIssues.push(
        `${key}: declared slot types are incompatible`
      )
      continue
    }
    addPair(
      slotRef(producerNode, producerSlot),
      slotRef(consumerNode, consumerSlot)
    )
  }
  return plan
}
