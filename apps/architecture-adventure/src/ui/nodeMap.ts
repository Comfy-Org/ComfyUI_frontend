import type { GameState } from '@/types'
import { edges } from '@/data/graph'
import { rooms } from '@/data/rooms'
import { isChallengeResolved, isRoomDiscovered } from '@/engine/navigation'
import { enterRoom } from '@/engine/stateMachine'
import { canEnterRoom } from '@/state/tags'

interface NodePosition {
  x: number
  y: number
}

const NODE_POSITIONS: Record<string, NodePosition> = {
  entry: { x: 300, y: 40 },
  components: { x: 120, y: 140 },
  stores: { x: 300, y: 140 },
  services: { x: 480, y: 140 },
  litegraph: { x: 60, y: 260 },
  sidepanel: { x: 180, y: 260 },
  ecs: { x: 300, y: 260 },
  renderer: { x: 420, y: 260 },
  composables: { x: 540, y: 260 },
  subgraph: { x: 300, y: 370 }
}

const SVG_WIDTH = 600
const SVG_HEIGHT = 440
const NODE_RADIUS = 28

function getNodeState(
  roomId: string,
  state: GameState
): 'locked' | 'visited' | 'current' {
  if (roomId === state.save.currentRun.currentRoom) return 'current'
  if (isRoomDiscovered(roomId, state.save)) return 'visited'
  return 'locked'
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K
): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', tag)
}

function buildEdges(): SVGGElement {
  const g = createSvgElement('g')
  const drawn = new Set<string>()

  for (const edge of edges) {
    const key = [edge.from, edge.to].sort().join('--')
    if (drawn.has(key)) continue
    drawn.add(key)

    const from = NODE_POSITIONS[edge.from]
    const to = NODE_POSITIONS[edge.to]
    if (!from || !to) continue

    const line = createSvgElement('line')
    line.setAttribute('class', 'map-edge')
    line.setAttribute('x1', String(from.x))
    line.setAttribute('y1', String(from.y))
    line.setAttribute('x2', String(to.x))
    line.setAttribute('y2', String(to.y))
    g.appendChild(line)
  }

  return g
}

function buildNode(
  roomId: string,
  state: GameState,
  onSelect: (id: string) => void
): SVGGElement {
  const room = rooms[roomId]
  const pos = NODE_POSITIONS[roomId]
  if (!room || !pos) return createSvgElement('g')

  const nodeState = getNodeState(roomId, state)
  const accessible = canEnterRoom(room, state.save)

  const g = createSvgElement('g')
  g.setAttribute('class', `map-node ${nodeState}`)
  g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`)

  if (accessible && nodeState !== 'locked') {
    g.style.cursor = 'pointer'
    g.addEventListener('click', () => onSelect(roomId))
  }

  const circle = createSvgElement('circle')
  circle.setAttribute('r', String(NODE_RADIUS))
  circle.setAttribute('cx', '0')
  circle.setAttribute('cy', '0')
  g.appendChild(circle)

  const label = createSvgElement('text')
  label.setAttribute('class', 'map-label')
  label.setAttribute('text-anchor', 'middle')
  label.setAttribute('dominant-baseline', 'middle')
  label.setAttribute('y', '0')
  label.textContent = room.id
  g.appendChild(label)

  const layerLabel = createSvgElement('text')
  layerLabel.setAttribute('class', 'map-title')
  layerLabel.setAttribute('text-anchor', 'middle')
  layerLabel.setAttribute('y', String(NODE_RADIUS + 12))
  layerLabel.textContent = room.layer
  g.appendChild(layerLabel)

  if (nodeState === 'locked') {
    const lock = createSvgElement('text')
    lock.setAttribute('class', 'map-lock')
    lock.setAttribute('text-anchor', 'middle')
    lock.setAttribute('dominant-baseline', 'middle')
    lock.setAttribute('y', String(-NODE_RADIUS - 8))
    lock.textContent = '🔒'
    g.appendChild(lock)
  } else if (room.challengeId) {
    const resolved = isChallengeResolved(room.challengeId, state.save)
    const badge = createSvgElement('text')
    badge.setAttribute('class', 'map-badge')
    badge.setAttribute('text-anchor', 'middle')
    badge.setAttribute('dominant-baseline', 'middle')
    badge.setAttribute('y', String(-NODE_RADIUS - 8))
    badge.textContent = resolved ? '✓' : '?'
    g.appendChild(badge)
  }

  return g
}

function buildSvg(
  state: GameState,
  onSelect: (id: string) => void
): SVGSVGElement {
  const svg = createSvgElement('svg')
  svg.setAttribute('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`)
  svg.setAttribute('width', '100%')
  svg.setAttribute('style', 'max-height: 440px;')

  svg.appendChild(buildEdges())

  for (const roomId of Object.keys(rooms)) {
    svg.appendChild(buildNode(roomId, state, onSelect))
  }

  return svg
}

function getDialog(): HTMLDialogElement | null {
  return document.getElementById('map-dialog') as HTMLDialogElement | null
}

function createMapOverlay(): HTMLDialogElement {
  const dialog = document.createElement('dialog')
  dialog.id = 'map-dialog'
  dialog.innerHTML = '<h3>Map</h3><div id="map-svg-container"></div>'

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close()
  })

  document.body.appendChild(dialog)
  return dialog
}

function renderMap(state: GameState): void {
  const container = document.getElementById('map-svg-container')
  if (!container) return

  container.innerHTML = ''

  const svg = buildSvg(state, (roomId) => {
    enterRoom(roomId)
    getDialog()?.close()
  })

  container.appendChild(svg)
}

function toggleMap(): void {
  const dialog = getDialog()
  if (!dialog) return

  if (dialog.open) {
    dialog.close()
  } else {
    dialog.showModal()
  }
}

export { createMapOverlay, renderMap, toggleMap }
