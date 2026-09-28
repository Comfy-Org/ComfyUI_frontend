/**
 * A workflow template read as a picture of itself. The reader on the
 * catalogue wants to see the shape of the graph before deciding whether to
 * take it anywhere, so this turns the stored litegraph JSON into laid-out
 * boxes and curves and nothing else: no execution, no editing, no litegraph.
 */

/** Litegraph's link colours, so the preview reads like the editor does. */
const TYPE_COLORS: Record<string, string> = {
  MODEL: '#b39ddb',
  CLIP: '#ffd500',
  CLIP_VISION: '#a5e751',
  VAE: '#ff6e6e',
  CONDITIONING: '#ffa931',
  LATENT: '#ff9cf9',
  IMAGE: '#64b5f6',
  MASK: '#81c784',
  AUDIO: '#ffd54f',
  VIDEO: '#7986cb',
  CONTROL_NET: '#00d78d'
}

const NEUTRAL = '#8b8b8b'

function colorForType(type: string | undefined): string {
  return (type && TYPE_COLORS[type.toUpperCase()]) || NEUTRAL
}

interface GraphSlot {
  readonly name: string
  readonly color: string
  /** Distance from the node's top edge. */
  readonly y: number
}

/**
 * A value the node carries on its face: a prompt, a file, a setting. A long
 * one is wrapped rather than cut, because the canvas gave it the room and a
 * node showing one clipped line of a note is the blank box over again.
 */
interface GraphWidget {
  readonly id: string
  readonly lines: readonly string[]
  readonly y: number
  readonly height: number
}

/**
 * What a node is for, where a picture could stand in it: the one that takes a
 * picture in, and the one that hands the result back.
 */
type NodeRole = 'input' | 'output'

export interface GraphNode {
  readonly id: string
  readonly title: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly accent: string
  /** The colours the graph itself chose, where it chose any. */
  readonly header: string | undefined
  readonly body: string | undefined
  /** Muted or bypassed, which the canvas draws faded rather than hiding. */
  readonly dimmed: boolean
  readonly inputs: readonly GraphSlot[]
  readonly outputs: readonly GraphSlot[]
  readonly widgets: readonly GraphWidget[]
  readonly role: NodeRole | undefined
  /** The template's own sample, filling the room the node left for one. */
  readonly picture: GraphPictureBand | undefined
}

interface GraphPictureBand {
  readonly href: string
  /** Distance from the node's top edge. */
  readonly y: number
  readonly height: number
}

/** A frame somebody drew around part of the graph, and what they called it. */
interface GraphGroup {
  readonly id: string
  readonly title: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}

export interface GraphLink {
  readonly id: string
  readonly color: string
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

export interface GraphPicture {
  readonly groups: readonly GraphGroup[]
  readonly nodes: readonly GraphNode[]
  readonly links: readonly GraphLink[]
  readonly viewBox: string
}

const TITLE_HEIGHT = 34
const SLOT_HEIGHT = 22
const SLOT_TOP = TITLE_HEIGHT + 16
const WIDGET_GAP = 8
const WIDGET_INSET = 8
const WIDGET_PAD = 9
const LINE_HEIGHT = 14
const WIDGET_HEIGHT = LINE_HEIGHT + WIDGET_PAD * 2
/** Close enough for the 11px face the node draws its values in. */
const CHARACTER_WIDTH = 6.2
const MIN_WIDTH = 180
const PADDING = 60
const GROUP_COLOR = '#3f3f46'

/** Litegraph writes a colour either in full or in the three-digit short form. */
function readColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const hex = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex
  if (!/^#[0-9a-f]{3}$/i.test(hex)) return undefined
  const [, r, g, b] = hex
  return `#${r}${r}${g}${g}${b}${b}`
}

function readPair(value: unknown): readonly [number, number] | undefined {
  if (Array.isArray(value) && value.length >= 2) {
    const [a, b] = value
    if (typeof a === 'number' && typeof b === 'number') return [a, b]
    return undefined
  }
  if (value && typeof value === 'object') {
    const pair = value as Record<string, unknown>
    if (typeof pair[0] === 'number' && typeof pair[1] === 'number')
      return [pair[0], pair[1]]
  }
  return undefined
}

function readSlots(value: unknown): readonly { name: string; type: string }[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((slot) => {
    if (!slot || typeof slot !== 'object') return []
    const record = slot as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name : ''
    const type = typeof record.type === 'string' ? record.type : ''
    return name || type ? [{ name: name || type, type }] : []
  })
}

/**
 * The title a reader recognises: whoever saved the graph may have renamed the
 * node, and the class name is the fallback rather than the other way round.
 */
/** The least room a sample is worth drawing in. */
const MIN_PICTURE = 120
const PICTURE_INSET = 8

function roleOf(type: unknown): NodeRole | undefined {
  if (typeof type !== 'string') return undefined
  if (/^Load(Image|Video|Audio)/.test(type)) return 'input'
  if (/^(Save|Preview)(Image|Video|Audio|Animated|WEBM)/.test(type))
    return 'output'
  return undefined
}

function readTitle(record: Record<string, unknown>): string {
  if (typeof record.title === 'string' && record.title.trim())
    return record.title.trim()
  if (typeof record.type === 'string' && record.type) return record.type
  return 'Node'
}

function slotY(index: number): number {
  return SLOT_TOP + index * SLOT_HEIGHT
}

function drawnSlots(
  slots: readonly { name: string; type: string }[]
): GraphSlot[] {
  return slots.map((slot, index) => ({
    name: slot.name,
    color: colorForType(slot.type),
    y: slotY(index)
  }))
}

/**
 * What a saved value reads as on the node's face. Anything structured was
 * never a face value to begin with, so it is left out rather than printed as
 * a shape nobody put there.
 */
function widgetText(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(3)))
}

function readWidgetValues(value: unknown): readonly string[] {
  const saved = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value)
      : []
  return saved.flatMap((entry) => widgetText(entry) ?? [])
}

/** Breaks on spaces where it can, and mid-word only when a word cannot fit. */
function wrap(text: string, perLine: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length <= perLine) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = word
    while (line.length > perLine) {
      lines.push(line.slice(0, perLine))
      line = line.slice(perLine)
    }
  }
  if (line) lines.push(line)
  return lines.length > 0 ? lines : ['']
}

/**
 * The values sit under the slots and fill the room the canvas left for them.
 * Each takes the lines it needs until the node's bottom edge, and the one that
 * runs into it ends in an ellipsis rather than spilling out of the box.
 */
function drawnWidgets(
  values: readonly string[],
  rows: number,
  width: number,
  height: number
): GraphWidget[] {
  const perLine = Math.max(
    4,
    Math.floor((width - WIDGET_INSET * 2 - WIDGET_PAD * 2) / CHARACTER_WIDTH)
  )
  const bottom = height - 6
  const drawn: GraphWidget[] = []
  let y = slotY(rows) + WIDGET_GAP

  for (const [index, value] of values.entries()) {
    const room = Math.floor((bottom - y - WIDGET_PAD * 2) / LINE_HEIGHT)
    if (room < 1) break
    const wrapped = wrap(value, perLine)
    const lines =
      wrapped.length <= room
        ? wrapped
        : [...wrapped.slice(0, room - 1), `${wrapped[room - 1]}…`]
    const box = lines.length * LINE_HEIGHT + WIDGET_PAD * 2
    drawn.push({ id: `w${index}`, lines, y, height: box })
    y += box + 4
  }
  return drawn
}

/**
 * Wide enough to read, and as tall as the canvas made it: a saved height was
 * chosen around these very values, so it decides how many of them show. Only
 * a node saved without a size is grown to hold them.
 */
function boxFor(
  size: readonly [number, number] | undefined,
  rows: number,
  values: number
): { width: number; height: number } {
  const forValues =
    slotY(rows) +
    (values > 0 ? WIDGET_GAP + values * (WIDGET_HEIGHT + 4) : 0) +
    8
  const saved = size?.[1]
  return {
    width: Math.max(size?.[0] ?? MIN_WIDTH, MIN_WIDTH),
    height: saved === undefined ? forValues : Math.max(saved, slotY(rows) + 8)
  }
}

function identity(record: Record<string, unknown>): string | undefined {
  const { id } = record
  return typeof id === 'number' || typeof id === 'string'
    ? String(id)
    : undefined
}

function nodeFrom(value: unknown): GraphNode | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const id = identity(record)
  const position = readPair(record.pos)
  if (!id || !position) return undefined

  const inputs = readSlots(record.inputs)
  const outputs = readSlots(record.outputs)
  const rows = Math.max(inputs.length, outputs.length)
  const values = readWidgetValues(record.widgets_values)
  const box = boxFor(readPair(record.size), rows, values.length)

  return {
    id,
    title: readTitle(record),
    x: position[0],
    y: position[1],
    ...box,
    accent: colorForType(outputs.at(0)?.type),
    header: readColor(record.color),
    body: readColor(record.bgcolor),
    // 0 runs. Anything else is a node the author left in place without letting
    // it run, and the canvas keeps it visible rather than removing it.
    dimmed: typeof record.mode === 'number' && record.mode !== 0,
    inputs: drawnSlots(inputs),
    outputs: drawnSlots(outputs),
    widgets: drawnWidgets(values, rows, box.width, box.height),
    role: roleOf(record.type),
    picture: undefined
  }
}

function groupFrom(value: unknown, index: number): GraphGroup | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const bounds = record.bounding
  if (!Array.isArray(bounds) || bounds.length < 4) return undefined
  const [x, y, width, height] = bounds
  if ([x, y, width, height].some((part) => typeof part !== 'number'))
    return undefined
  return {
    id: `g${index}`,
    title: typeof record.title === 'string' ? record.title : '',
    x: x as number,
    y: y as number,
    width: width as number,
    height: height as number,
    color: readColor(record.color) ?? GROUP_COLOR
  }
}

interface LinkEnds {
  readonly from: string
  readonly fromSlot: number
  readonly to: string
  readonly toSlot: number
  readonly type: string
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function slot(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

/** Litegraph's positional link: id, origin, slot, target, slot, type. */
function linkEndsFromRow(row: readonly unknown[]): LinkEnds | undefined {
  const [, from, fromSlot, to, toSlot, type] = row
  if (typeof fromSlot !== 'number' || typeof toSlot !== 'number')
    return undefined
  return {
    from: String(from),
    fromSlot,
    to: String(to),
    toSlot,
    type: text(type)
  }
}

/** The same link after the schema rewrite, with its ends named. */
function linkEndsFromRecord(
  record: Record<string, unknown>
): LinkEnds | undefined {
  const from = record.origin_id ?? record.source_id
  const to = record.target_id
  if (from === undefined || to === undefined) return undefined
  return {
    from: String(from),
    fromSlot: slot(record.origin_slot ?? record.source_slot),
    to: String(to),
    toSlot: slot(record.target_slot),
    type: text(record.type)
  }
}

/** A template on disk may hold either shape. */
function linkEndsFrom(value: unknown): LinkEnds | undefined {
  if (Array.isArray(value))
    return value.length >= 5 ? linkEndsFromRow(value) : undefined
  return value && typeof value === 'object'
    ? linkEndsFromRecord(value as Record<string, unknown>)
    : undefined
}

function linkBetween(
  ends: LinkEnds,
  from: GraphNode,
  to: GraphNode,
  index: number
): GraphLink {
  const output = from.outputs.at(ends.fromSlot)
  const input = to.inputs.at(ends.toSlot)
  return {
    id: `${ends.from}-${ends.fromSlot}-${ends.to}-${ends.toSlot}-${index}`,
    color: output?.color ?? colorForType(ends.type),
    x1: from.x + from.width,
    y1: from.y + (output?.y ?? slotY(ends.fromSlot)),
    x2: to.x,
    y2: to.y + (input?.y ?? slotY(ends.toSlot))
  }
}

function drawnLinks(
  rows: readonly unknown[],
  byId: ReadonlyMap<string, GraphNode>
): GraphLink[] {
  return rows.flatMap((row, index) => {
    const ends = linkEndsFrom(row)
    const from = ends && byId.get(ends.from)
    const to = ends && byId.get(ends.to)
    return ends && from && to ? [linkBetween(ends, from, to, index)] : []
  })
}

/**
 * A template publishes its own sample beside itself: two pictures where it has
 * a before and an after, one where it only has the result. Hanging them in the
 * nodes that hold them shows what the graph does, without inventing anything
 * the registry did not already publish.
 */
// A node that shows an image in the editor was saved tall enough to hold one,
// so the sample fills what the node already left empty and only stretches it
// where the author saved it small.
function hang(node: GraphNode, href: string): GraphNode {
  const top =
    Math.max(
      node.widgets.at(-1)
        ? node.widgets.at(-1)!.y + node.widgets.at(-1)!.height
        : 0,
      slotY(Math.max(node.inputs.length, node.outputs.length))
    ) + PICTURE_INSET
  const room = node.height - top - PICTURE_INSET
  const height = Math.max(room, MIN_PICTURE)
  return {
    ...node,
    picture: { href, y: top, height },
    height: Math.max(node.height, top + height + PICTURE_INSET)
  }
}

function withSamples(
  nodes: readonly GraphNode[],
  samples: readonly string[]
): readonly GraphNode[] {
  const hung = new Map<string, string>()
  const hold = (role: NodeRole, href: string | undefined) => {
    const held = nodes
      .filter((node) => node.role === role)
      .sort((a, b) => a.x - b.x)
      .at(role === 'input' ? 0 : -1)
    if (held && href) hung.set(held.id, href)
  }
  hold('input', samples.length > 1 ? samples[0] : undefined)
  hold('output', samples.at(-1))
  return nodes.map((node) => {
    const href = hung.get(node.id)
    return href ? hang(node, href) : node
  })
}

export function readGraphPicture(
  source: unknown,
  samples: readonly string[] = []
): GraphPicture {
  const record =
    source && typeof source === 'object'
      ? (source as Record<string, unknown>)
      : {}
  const nodes = withSamples(
    Array.isArray(record.nodes)
      ? record.nodes.flatMap((entry) => nodeFrom(entry) ?? [])
      : [],
    samples
  )

  const groups = Array.isArray(record.groups)
    ? record.groups.flatMap((entry, index) => groupFrom(entry, index) ?? [])
    : []

  return {
    groups,
    nodes,
    links: drawnLinks(
      Array.isArray(record.links) ? record.links : [],
      new Map(nodes.map((node) => [node.id, node]))
    ),
    viewBox: viewBoxFor(nodes, groups)
  }
}

interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** A group reaches past the nodes it frames, so the frame is measured too. */
function viewBoxFor(
  nodes: readonly GraphNode[],
  groups: readonly GraphGroup[] = []
): string {
  const boxes: readonly Box[] = [...nodes, ...groups]
  if (boxes.length === 0) return '0 0 800 450'
  const left = Math.min(...boxes.map((box) => box.x)) - PADDING
  const top = Math.min(...boxes.map((box) => box.y)) - PADDING
  const right = Math.max(...boxes.map((box) => box.x + box.width)) + PADDING
  const bottom = Math.max(...boxes.map((box) => box.y + box.height)) + PADDING
  return `${left} ${top} ${right - left} ${bottom - top}`
}

/** A cubic that leaves an output rightwards and enters an input leftwards. */
export function linkPath(link: GraphLink): string {
  const reach = Math.max(60, Math.abs(link.x2 - link.x1) * 0.5)
  return `M ${link.x1} ${link.y1} C ${link.x1 + reach} ${link.y1}, ${link.x2 - reach} ${link.y2}, ${link.x2} ${link.y2}`
}
