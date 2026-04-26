import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useRightSidePanelStore } from '@/stores/workspace/rightSidePanelStore'
import type { RightSidePanelTab } from '@/stores/workspace/rightSidePanelStore'
import { useCommandStore } from '@/stores/commandStore'
import { useSidebarTabStore } from '@/stores/workspace/sidebarTabStore'

import type { Command, CommandRegistry } from '../types'
import { emptyIter, stringIter } from '../types'

interface PosSizeNode {
  id: number | string
  pos: [number, number]
  size: [number, number]
  comfyClass?: string
  type?: string
}

function captureUndo(): void {
  try {
    useWorkflowStore().activeWorkflow?.changeTracker?.checkState()
  } catch {
    /* no-op */
  }
}

function getCanvas() {
  return useCanvasStore().canvas
}

function getGraph() {
  return getCanvas()?.graph ?? null
}

function getSelectedNodes(): PosSizeNode[] {
  const canvas = getCanvas()
  if (!canvas) return []
  const selected = (canvas as { selected_nodes?: Record<string, PosSizeNode> })
    .selected_nodes
  if (!selected) return []
  return Object.values(selected)
}

/**
 * node-search <pattern>
 *
 * Returns matching node type names from LiteGraph.registered_node_types.
 * Case-insensitive substring or regex match. One per line, sorted.
 */
const nodeSearch: Command = async (ctx) => {
  const pattern = ctx.argv.slice(1).join(' ').trim()
  if (!pattern) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: node-search <pattern>'
    }
  }
  const registered = LiteGraph.registered_node_types ?? {}
  let regex: RegExp
  try {
    regex = new RegExp(pattern, 'i')
  } catch {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    regex = new RegExp(escaped, 'i')
  }
  const matches = Object.keys(registered)
    .filter((type) => regex.test(type))
    .sort()
  if (matches.length === 0) {
    return { stdout: stringIter(''), exitCode: 0 }
  }
  return {
    stdout: stringIter(matches.join('\n') + '\n'),
    exitCode: 0
  }
}

/**
 * add-node <type> [x] [y]
 *
 * Create a node of the given registered type and add it to the active
 * graph. Positions at [x, y] (default [100, 100]). Prints the new node id.
 */
interface ViewportCanvas {
  ds?: { offset: [number, number]; scale: number }
  canvas?: { width: number; height: number }
}

/**
 * Pick a non-overlapping position near the viewport center. Scans outward
 * in a spiral grid until it finds a cell that doesn't intersect any
 * existing node's AABB. Returns the top-left for the new node.
 */
function pickEmptySpot(
  graph: { _nodes?: PosSizeNode[] },
  canvas: ViewportCanvas,
  nodeSize: [number, number] = [220, 100]
): [number, number] {
  const nodes = graph._nodes ?? []
  const ds = canvas.ds
  const vp = canvas.canvas
  let centerX = 0
  let centerY = 0
  if (ds && vp) {
    // Viewport center in graph coords: (-offset + viewport/2) / scale
    centerX = (-ds.offset[0] + vp.width / 2) / ds.scale
    centerY = (-ds.offset[1] + vp.height / 2) / ds.scale
  } else if (nodes.length > 0) {
    centerX = nodes.reduce((s, n) => s + n.pos[0], 0) / nodes.length
    centerY = nodes.reduce((s, n) => s + n.pos[1], 0) / nodes.length
  }
  const [w, h] = nodeSize
  const pad = 40
  const stepX = w + pad
  const stepY = h + pad

  const overlaps = (x: number, y: number): boolean =>
    nodes.some((n) => {
      const [nx, ny] = n.pos
      const [nw, nh] = n.size ?? [220, 100]
      return !(x + w < nx || nx + nw < x || y + h < ny || ny + nh < y)
    })

  const origin: [number, number] = [centerX - w / 2, centerY - h / 2]
  if (!overlaps(origin[0], origin[1])) return origin

  // Spiral outward: rings of radius r, check each grid cell.
  for (let r = 1; r < 40; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
        const x = origin[0] + dx * stepX
        const y = origin[1] + dy * stepY
        if (!overlaps(x, y)) return [x, y]
      }
    }
  }
  return origin
}

const addNode: Command = async (ctx) => {
  const [, typeArg, xArg, yArg] = ctx.argv
  if (!typeArg) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: add-node <type> [x] [y]'
    }
  }
  const graph = getGraph()
  if (!graph) {
    return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  }
  if (!LiteGraph.registered_node_types?.[typeArg]) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `add-node: unknown type "${typeArg}" — try: node-search <pattern>`
    }
  }
  const xyGiven = xArg !== undefined && yArg !== undefined
  const x = xArg !== undefined ? Number(xArg) : Number.NaN
  const y = yArg !== undefined ? Number(yArg) : Number.NaN
  if (xyGiven && (!Number.isFinite(x) || !Number.isFinite(y))) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'add-node: x and y must be numbers'
    }
  }
  try {
    const node = LiteGraph.createNode(typeArg)
    if (!node) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: `add-node: failed to create node of type "${typeArg}"`
      }
    }
    if (xyGiven) {
      node.pos = [x, y]
    } else {
      const canvas = getCanvas() as unknown as ViewportCanvas
      const pos = pickEmptySpot(
        graph as { _nodes?: PosSizeNode[] },
        canvas,
        (node as { size?: [number, number] }).size ?? [220, 100]
      )
      node.pos = pos
    }
    ;(graph as { add: (n: unknown) => void }).add(node)
    getCanvas()?.setDirty(true, true)
    captureUndo()
    return {
      stdout: stringIter(`${(node as { id: number | string }).id}\n`),
      exitCode: 0
    }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

type AlignAxis = 'left' | 'right' | 'center-x' | 'top' | 'bottom' | 'center-y'

const ALIGN_AXES: readonly AlignAxis[] = [
  'left',
  'right',
  'center-x',
  'top',
  'bottom',
  'center-y'
]

/**
 * align-nodes <axis>
 *
 * Align currently-selected nodes to a common edge/center on the given axis.
 * Axis: left | right | center-x | top | bottom | center-y
 */
const alignNodes: Command = async (ctx) => {
  const axis = ctx.argv[1] as AlignAxis | undefined
  if (!axis || !ALIGN_AXES.includes(axis)) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: `usage: align-nodes <${ALIGN_AXES.join('|')}>`
    }
  }
  const selected = getSelectedNodes()
  if (selected.length < 2) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: 'align-nodes: select at least 2 nodes'
    }
  }
  const xs = selected.map((n) => n.pos[0])
  const ys = selected.map((n) => n.pos[1])
  const rights = selected.map((n) => n.pos[0] + (n.size?.[0] ?? 0))
  const bottoms = selected.map((n) => n.pos[1] + (n.size?.[1] ?? 0))

  for (const n of selected) {
    const w = n.size?.[0] ?? 0
    const h = n.size?.[1] ?? 0
    if (axis === 'left') n.pos[0] = Math.min(...xs)
    else if (axis === 'right') n.pos[0] = Math.max(...rights) - w
    else if (axis === 'center-x') {
      const cx =
        (Math.min(...xs) +
          Math.max(...selected.map((s) => s.pos[0] + (s.size?.[0] ?? 0)))) /
        2
      n.pos[0] = cx - w / 2
    } else if (axis === 'top') n.pos[1] = Math.min(...ys)
    else if (axis === 'bottom') n.pos[1] = Math.max(...bottoms) - h
    else if (axis === 'center-y') {
      const cy =
        (Math.min(...ys) +
          Math.max(...selected.map((s) => s.pos[1] + (s.size?.[1] ?? 0)))) /
        2
      n.pos[1] = cy - h / 2
    }
  }
  getCanvas()?.setDirty(true, true)
  captureUndo()
  return {
    stdout: stringIter(`aligned ${selected.length} nodes (${axis})\n`),
    exitCode: 0
  }
}

/**
 * distribute-nodes <h|v>
 *
 * Distribute selected nodes evenly along horizontal (h) or vertical (v)
 * axis between the first and last node's current positions.
 */
const distributeNodes: Command = async (ctx) => {
  const axis = ctx.argv[1]
  if (axis !== 'h' && axis !== 'v') {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: distribute-nodes <h|v>'
    }
  }
  const selected = getSelectedNodes()
  if (selected.length < 3) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: 'distribute-nodes: select at least 3 nodes'
    }
  }
  const dim = axis === 'h' ? 0 : 1
  const sorted = [...selected].sort((a, b) => a.pos[dim] - b.pos[dim])
  const first = sorted[0].pos[dim]
  const last = sorted[sorted.length - 1].pos[dim]
  const step = (last - first) / (sorted.length - 1)
  sorted.forEach((n, i) => {
    n.pos[dim] = first + step * i
  })
  getCanvas()?.setDirty(true, true)
  captureUndo()
  return {
    stdout: stringIter(
      `distributed ${sorted.length} nodes along ${axis === 'h' ? 'horizontal' : 'vertical'}\n`
    ),
    exitCode: 0
  }
}

/**
 * toggle-panel <name>
 *
 * Open/close a right-side or left-side sidebar tab by name.
 *
 * Right-side panel tabs: parameters | nodes | settings | info | subgraph | errors
 * Left-side sidebar tabs: whatever is registered (queue, history, assets, workflows, models, node-library, apps)
 */
const RIGHT_TABS: readonly RightSidePanelTab[] = [
  'parameters',
  'nodes',
  'settings',
  'info',
  'subgraph',
  'errors'
]

const togglePanel: Command = async (ctx) => {
  const name = ctx.argv[1]?.trim().toLowerCase()
  if (!name) {
    const right = `right: ${RIGHT_TABS.join(', ')}`
    const leftTabs = useSidebarTabStore()
      .sidebarTabs.map((t) => t.id)
      .join(', ')
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: `usage: toggle-panel <name>\n  ${right}\n  left (sidebar): ${leftTabs}`
    }
  }

  // Queue + history are command-driven overlays, not sidebar tabs — route
  // them through the command store so the user's mental model ("open the
  // queue panel") still works.
  const overlayCommands: Record<string, string> = {
    queue: 'Comfy.Queue.ToggleOverlay',
    history: 'Comfy.Queue.ToggleOverlay',
    'job-history': 'Comfy.Queue.ToggleOverlay'
  }
  if (overlayCommands[name]) {
    try {
      await useCommandStore().execute(overlayCommands[name])
      return {
        stdout: stringIter(`toggled ${name} overlay\n`),
        exitCode: 0
      }
    } catch (err) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: err instanceof Error ? err.message : String(err)
      }
    }
  }

  // Alias common names to panel/sidebar ids. Only alias names that we know
  // map to a real registered tab id in this build.
  const aliases: Record<string, string> = {
    'missing-models': 'errors',
    'model-library': 'models',
    'node-library': 'node-library'
  }
  const resolved = aliases[name] ?? name

  if ((RIGHT_TABS as readonly string[]).includes(resolved)) {
    const store = useRightSidePanelStore()
    const isSame = store.activeTab === resolved && store.isOpen
    if (isSame) {
      store.closePanel()
      return {
        stdout: stringIter(`closed right panel (${resolved})\n`),
        exitCode: 0
      }
    }
    store.openPanel(resolved as RightSidePanelTab)
    return {
      stdout: stringIter(`opened right panel (${resolved})\n`),
      exitCode: 0
    }
  }

  const sidebar = useSidebarTabStore()
  const tab = sidebar.sidebarTabs.find((t) => t.id === resolved)
  if (!tab) {
    const known = sidebar.sidebarTabs.map((t) => t.id).join(', ')
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `toggle-panel: unknown panel "${name}"\n  right: ${RIGHT_TABS.join(', ')}\n  sidebar: ${known}`
    }
  }
  sidebar.toggleSidebarTab(tab.id)
  const nowActive = sidebar.activeSidebarTabId === tab.id
  return {
    stdout: stringIter(
      `${nowActive ? 'opened' : 'closed'} sidebar tab (${tab.id})\n`
    ),
    exitCode: 0
  }
}

/**
 * select <idOrSpec...>
 *
 * Select one or more nodes. Accepts:
 *   - node ids:      select 3 5 7
 *   - type filter:   select type=KSampler
 *   - "all":         select all
 *   - "none":        select none (clears)
 *
 * Needed before align-nodes / distribute-nodes.
 */
interface CanvasWithSelection {
  selected_nodes: Record<string, unknown>
  selectNode?: (node: unknown, keep?: boolean) => void
  deselectAllNodes?: () => void
  setDirty?: (a: boolean, b: boolean) => void
}

const selectCmd: Command = async (ctx) => {
  const args = ctx.argv.slice(1)
  if (args.length === 0) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: select <id...> | type=<Type> | all | none'
    }
  }
  const graph = getGraph() as { _nodes?: unknown[] } | null
  const canvas = getCanvas() as unknown as CanvasWithSelection | null
  if (!graph?._nodes || !canvas) {
    return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  }
  canvas.deselectAllNodes?.()

  const nodes = graph._nodes as Array<{ id: number; type?: string }>
  let picked: typeof nodes = []

  if (args[0] === 'none') {
    canvas.setDirty?.(true, true)
    return { stdout: stringIter('selection cleared\n'), exitCode: 0 }
  }
  if (args[0] === 'all') {
    picked = nodes
  } else {
    for (const a of args) {
      if (a.startsWith('type=')) {
        const t = a.slice(5)
        picked.push(...nodes.filter((n) => n.type === t))
      } else if (/^\d+$/.test(a)) {
        const id = Number(a)
        const n = nodes.find((node) => node.id === id)
        if (n) picked.push(n)
      } else {
        return {
          stdout: emptyIter(),
          exitCode: 2,
          stderr: `select: unrecognised token "${a}" (expected id, type=X, all, or none)`
        }
      }
    }
  }
  for (const n of picked) canvas.selectNode?.(n, true)
  canvas.setDirty?.(true, true)
  return {
    stdout: stringIter(
      `selected ${picked.length} node${picked.length === 1 ? '' : 's'}: ${picked
        .map((n) => n.id)
        .join(', ')}\n`
    ),
    exitCode: 0
  }
}

/**
 * connect <fromId>.<output> <toId>.<input>
 *
 * Create a link. output/input may be the socket index (0-based) or name.
 * Example:
 *   connect 3.0 5.0              # first output of node 3 → first input of 5
 *   connect 3.LATENT 5.samples   # by socket name
 */
interface LinkableNode {
  id: number
  outputs?: Array<{ name?: string }>
  inputs?: Array<{ name?: string }>
  connect: (fromSlot: number, target: LinkableNode, toSlot: number) => unknown
}

function resolveSlot(
  socket: string,
  slots: Array<{ name?: string }> | undefined
): number | null {
  if (!slots) return null
  if (/^\d+$/.test(socket)) {
    const i = Number(socket)
    return i >= 0 && i < slots.length ? i : null
  }
  const idx = slots.findIndex((s) => s.name === socket)
  return idx >= 0 ? idx : null
}

const connectCmd: Command = async (ctx) => {
  const [, from, to] = ctx.argv
  if (!from || !to) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: connect <fromId>.<output> <toId>.<input>'
    }
  }
  const fromMatch = from.match(/^(\d+)\.(.+)$/)
  const toMatch = to.match(/^(\d+)\.(.+)$/)
  if (!fromMatch || !toMatch) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'connect: both args must be <id>.<socket>'
    }
  }
  const graph = getGraph() as { _nodes?: LinkableNode[] } | null
  const nodes = graph?._nodes
  if (!nodes) {
    return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  }
  const fromNode = nodes.find((n) => n.id === Number(fromMatch[1]))
  const toNode = nodes.find((n) => n.id === Number(toMatch[1]))
  if (!fromNode || !toNode) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `connect: node not found (${!fromNode ? fromMatch[1] : toMatch[1]})`
    }
  }
  const fromSlot = resolveSlot(fromMatch[2], fromNode.outputs)
  const toSlot = resolveSlot(toMatch[2], toNode.inputs)
  if (fromSlot === null || toSlot === null) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `connect: socket not found (from=${fromMatch[2]} to=${toMatch[2]})`
    }
  }
  try {
    const link = fromNode.connect(fromSlot, toNode, toSlot)
    if (!link) {
      return {
        stdout: emptyIter(),
        exitCode: 1,
        stderr: 'connect: link rejected (type mismatch?)'
      }
    }
    getCanvas()?.setDirty(true, true)
    captureUndo()
    // Auto-layout after successful connect so the canvas stays readable.
    // Opt out with --no-layout for users hand-placing nodes.
    const suppress = ctx.argv.includes('--no-layout')
    let extra = ''
    if (!suppress) {
      extra = ' + ' + runLayout('lr')
    }
    return {
      stdout: stringIter(
        `connected ${fromNode.id}.${fromMatch[2]} → ${toNode.id}.${toMatch[2]}${extra}\n`
      ),
      exitCode: 0
    }
  } catch (err) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: err instanceof Error ? err.message : String(err)
    }
  }
}

/**
 * layout [lr|tb]
 *
 * Topological tree layout of the active graph. `lr` = left-to-right (default,
 * natural for ComfyUI pipelines); `tb` = top-to-bottom. Uses longest-path
 * levelling with stable within-level ordering by id. Captures undo.
 */
interface LayoutNode {
  id: number
  pos: [number, number]
  size?: [number, number]
}

interface LayoutLink {
  origin_id: number
  target_id: number
}

function runLayout(direction: 'lr' | 'tb' = 'lr'): string {
  const graph = getGraph() as {
    _nodes?: LayoutNode[]
    links?: LayoutLink[] | Record<string, LayoutLink>
  } | null
  const nodes = graph?._nodes
  if (!nodes || nodes.length === 0) return 'layout: nothing to do'
  const rawLinks = graph?.links
  const links: LayoutLink[] = Array.isArray(rawLinks)
    ? rawLinks.filter(Boolean)
    : Object.values(rawLinks ?? {}).filter(Boolean)

  const parents = new Map<number, Set<number>>()
  for (const n of nodes) parents.set(n.id, new Set())
  for (const l of links) parents.get(l.target_id)?.add(l.origin_id)

  const lvl = new Map<number, number>()
  for (const n of nodes) lvl.set(n.id, 0)
  let changed = true
  let guard = nodes.length * 2
  while (changed && guard-- > 0) {
    changed = false
    for (const n of nodes) {
      let m = -1
      for (const p of parents.get(n.id) ?? []) m = Math.max(m, lvl.get(p) ?? 0)
      if (m + 1 > (lvl.get(n.id) ?? 0)) {
        lvl.set(n.id, m + 1)
        changed = true
      }
    }
  }

  const byLv = new Map<number, LayoutNode[]>()
  for (const n of nodes) {
    const k = lvl.get(n.id) ?? 0
    if (!byLv.has(k)) byLv.set(k, [])
    byLv.get(k)?.push(n)
  }
  const keys = [...byLv.keys()].sort((a, b) => a - b)

  if (direction === 'lr') {
    let x = 60
    for (const k of keys) {
      const col = (byLv.get(k) ?? []).sort((a, b) => a.id - b.id)
      let y = 60
      let maxW = 0
      for (const n of col) {
        n.pos = [x, y]
        y += (n.size?.[1] ?? 100) + 40
        maxW = Math.max(maxW, n.size?.[0] ?? 220)
      }
      x += maxW + 60
    }
  } else {
    let y = 60
    for (const k of keys) {
      const row = (byLv.get(k) ?? []).sort((a, b) => a.id - b.id)
      let x = 60
      let maxH = 0
      for (const n of row) {
        n.pos = [x, y]
        x += (n.size?.[0] ?? 220) + 40
        maxH = Math.max(maxH, n.size?.[1] ?? 100)
      }
      y += maxH + 60
    }
  }
  getCanvas()?.setDirty(true, true)
  captureUndo()
  return `laid out ${nodes.length} nodes (${direction})`
}

const layoutCmd: Command = async (ctx) => {
  const dir = (ctx.argv[1] ?? 'lr').toLowerCase()
  if (dir !== 'lr' && dir !== 'tb') {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: layout [lr|tb]'
    }
  }
  return { stdout: stringIter(runLayout(dir) + '\n'), exitCode: 0 }
}

/**
 * disconnect <id>.<input>
 *
 * Remove the link feeding a specific input socket. Auto-layouts afterwards
 * (opt out with --no-layout). To clear multiple, call repeatedly.
 */
interface DisconnectableNode {
  id: number
  inputs?: Array<{ name?: string }>
  disconnectInput: (slot: number) => boolean
}

const disconnectCmd: Command = async (ctx) => {
  const target = ctx.argv[1]
  if (!target) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: disconnect <id>.<input>  [--no-layout]'
    }
  }
  const match = target.match(/^(\d+)\.(.+)$/)
  if (!match) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'disconnect: arg must be <id>.<socket>'
    }
  }
  const graph = getGraph() as { _nodes?: DisconnectableNode[] } | null
  const node = graph?._nodes?.find((n) => n.id === Number(match[1]))
  if (!node) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `disconnect: no node ${match[1]}`
    }
  }
  const slot = resolveSlot(match[2], node.inputs)
  if (slot === null) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `disconnect: unknown input "${match[2]}" on node ${node.id}`
    }
  }
  const ok = node.disconnectInput(slot)
  getCanvas()?.setDirty(true, true)
  captureUndo()
  const suppress = ctx.argv.includes('--no-layout')
  const extra = !suppress ? ' + ' + runLayout('lr') : ''
  return {
    stdout: stringIter(
      ok
        ? `disconnected ${node.id}.${match[2]}${extra}\n`
        : `disconnect: ${node.id}.${match[2]} was not connected\n`
    ),
    exitCode: 0
  }
}

/**
 * remove-node <id...>
 *
 * Delete one or more nodes from the active graph. Auto-layouts after.
 */
interface RemovableGraph {
  _nodes?: Array<{ id: number }>
  remove: (node: unknown) => void
}

const removeNode: Command = async (ctx) => {
  const ids = ctx.argv
    .slice(1)
    .filter((a) => !a.startsWith('--'))
    .map((a) => Number(a))
    .filter((n) => Number.isFinite(n))
  if (ids.length === 0) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: remove-node <id...>  [--no-layout]'
    }
  }
  const graph = getGraph() as unknown as RemovableGraph | null
  if (!graph?._nodes) {
    return { stdout: emptyIter(), exitCode: 1, stderr: 'no active graph' }
  }
  const removed: number[] = []
  for (const id of ids) {
    const n = graph._nodes.find((x) => x.id === id)
    if (n) {
      graph.remove(n)
      removed.push(id)
    }
  }
  getCanvas()?.setDirty(true, true)
  captureUndo()
  const suppress = ctx.argv.includes('--no-layout')
  const extra = !suppress && removed.length > 0 ? ' + ' + runLayout('lr') : ''
  return {
    stdout: stringIter(
      `removed ${removed.length} node(s): ${removed.join(', ')}${extra}\n`
    ),
    exitCode: 0
  }
}

/**
 * get-widget <id> <name>
 *
 * Read a widget's current value. Complements set-widget.
 */
interface WidgetCarrier {
  id: number
  widgets?: Array<{ name?: string; value?: unknown }>
}

const getWidget: Command = async (ctx) => {
  const [, idArg, nameArg] = ctx.argv
  if (!idArg || !nameArg) {
    return {
      stdout: emptyIter(),
      exitCode: 2,
      stderr: 'usage: get-widget <id> <name>'
    }
  }
  const graph = getGraph() as { _nodes?: WidgetCarrier[] } | null
  const node = graph?._nodes?.find((n) => n.id === Number(idArg))
  if (!node) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `get-widget: no node ${idArg}`
    }
  }
  const widget = node.widgets?.find((w) => w.name === nameArg)
  if (!widget) {
    return {
      stdout: emptyIter(),
      exitCode: 1,
      stderr: `get-widget: no widget "${nameArg}" on node ${idArg}`
    }
  }
  return {
    stdout: stringIter(JSON.stringify(widget.value) + '\n'),
    exitCode: 0
  }
}

export function registerNodeOpsCommands(registry: CommandRegistry): void {
  registry.register('node-search', nodeSearch)
  registry.register('add-node', addNode)
  registry.register('align-nodes', alignNodes)
  registry.register('distribute-nodes', distributeNodes)
  registry.register('toggle-panel', togglePanel)
  registry.register('select', selectCmd)
  registry.register('connect', connectCmd)
  registry.register('get-widget', getWidget)
  registry.register('layout', layoutCmd)
  registry.register('disconnect', disconnectCmd)
  registry.register('remove-node', removeNode)
}
