export interface ClientBox {
  x: number
  y: number
  width: number
  height: number
}

export interface WidgetMeasure {
  name: string
  type: string
  custom: boolean
  shownInOwner: boolean
  coveredBy: string | null
  visible: boolean
  reachable: boolean | null
  rect: ClientBox | null
  clippedPixels: number
}

export interface HookDrawing {
  pixels: number
  distinctPixels: number
  colours: number[]
  samples?: { x: number; y: number; colour: number }[]
  box: ClientBox
  nodeSize: { width: number; height: number }
}

export interface NodeMeasure {
  rendered: boolean
  rect: ClientBox | null
  widgets: WidgetMeasure[]
  overflow: number
  drawing: HookDrawing | null
  drawingFound: number | null
  drawCalls: number | null
  bodyInteractive: boolean
  errors: string[]
  image: string | null
}

export const NODE_BODY = '(node body)'

export interface ProbeTarget {
  target: string
  x: number
  y: number
}

export interface ProbeOutcome extends ProbeTarget {
  changed: string[]
  transitions?: Record<string, { before: string | null; after: string | null }>
  unavailable?: string
  popup: boolean
  pixels: number
}

export interface SurveyedNode {
  type: string
  classic: NodeMeasure
  nodes2: NodeMeasure
  probes: { classic: ProbeOutcome[]; nodes2: ProbeOutcome[] }
}

export interface LayoutData {
  pack: string
  commit: string
  finishedAt: string
  nodes: SurveyedNode[]
}

export type LayoutFinding =
  | { kind: 'notRendered' }
  | { kind: 'classicUnavailable'; detail: string }
  | { kind: 'comparisonUnavailable'; widget: string; detail: string }
  | { kind: 'tooBig' | 'tooSmall'; detail: string }
  | { kind: 'hidden'; widget: string }
  | { kind: 'covered'; widget: string; by: string | null }
  | { kind: 'clipped'; widget: string; pixels: number }
  | { kind: 'overflow'; pixels: number }
  | { kind: 'drawingMissing'; pixels: number; found: number }
  | { kind: 'error'; message: string }
  | { kind: 'noResponse' | 'differentResponse'; widget: string; detail: string }

const GROWTH_RATIO = 1.5
const SHRINK_RATIO = 0.8
const MIN_GROWTH_PX = 40
const MIN_SHRINK_PX = 20
const MIN_CLIPPED_PIXELS = 25
const MIN_OVERFLOW_PX = 4
const MIN_FOUND_SHARE = 0.3
const MIN_VISUAL_RESPONSE_PIXELS = 20
export const MIN_DRAWN_PIXELS = 50

function axisFinding(
  axis: 'height' | 'width',
  classic: number,
  nodes2: number
): LayoutFinding | null {
  const detail = `${axis} ${Math.round(classic)} → ${Math.round(nodes2)} px`
  if (nodes2 > classic * GROWTH_RATIO && nodes2 - classic > MIN_GROWTH_PX)
    return { kind: 'tooBig', detail }
  if (nodes2 < classic * SHRINK_RATIO && classic - nodes2 > MIN_SHRINK_PX)
    return { kind: 'tooSmall', detail }
  return null
}

function sizeFindings(classic: ClientBox, nodes2: ClientBox): LayoutFinding[] {
  return [
    axisFinding('height', classic.height, nodes2.height),
    axisFinding('width', classic.width, nodes2.width)
  ].filter((finding) => finding !== null)
}

function widgetFindings(
  classic: WidgetMeasure[],
  nodes2: WidgetMeasure[]
): LayoutFinding[] {
  return classic
    .filter((widget) => widget.visible && !widget.shownInOwner)
    .flatMap((widget): LayoutFinding[] => {
      const match = nodes2.find((other) => other.name === widget.name)
      if (!match?.visible) return [{ kind: 'hidden', widget: widget.name }]
      const findings: LayoutFinding[] = []
      if (match.reachable === false)
        findings.push({
          kind: 'covered',
          widget: widget.name,
          by: match.coveredBy
        })
      if (match.clippedPixels >= MIN_CLIPPED_PIXELS)
        findings.push({
          kind: 'clipped',
          widget: widget.name,
          pixels: match.clippedPixels
        })
      return findings
    })
}

function responded(outcome: ProbeOutcome) {
  return (
    outcome.changed.length > 0 ||
    outcome.popup ||
    outcome.pixels >= MIN_VISUAL_RESPONSE_PIXELS
  )
}

function describeResponse(outcome: ProbeOutcome) {
  const parts = [
    ...outcome.changed.map((key) => {
      const transition = outcome.transitions?.[key]
      return transition
        ? `${key}: ${transition.before} → ${transition.after}`
        : key
    }),
    ...(outcome.popup ? ['opened a popup'] : []),
    ...(outcome.pixels >= MIN_VISUAL_RESPONSE_PIXELS
      ? [`${outcome.pixels} px repainted`]
      : [])
  ]
  return parts.length ? parts.join(', ') : 'nothing'
}

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`

function clickPosition(target: ProbeTarget) {
  return target.target === NODE_BODY
    ? `click at ${percent(target.x)} across, ${percent(target.y)} down`
    : `click at ${percent(target.x)} of the row`
}

function probeFindings(probes: SurveyedNode['probes']): LayoutFinding[] {
  return probes.classic.flatMap((classic): LayoutFinding[] => {
    if (classic.unavailable)
      return [
        {
          kind: 'comparisonUnavailable',
          widget: classic.target,
          detail: `classic: ${classic.unavailable}`
        }
      ]
    if (!responded(classic)) return []
    const nodes2 = probes.nodes2.find(
      (other) =>
        other.target === classic.target &&
        other.x === classic.x &&
        other.y === classic.y
    )
    const where = clickPosition(classic)
    if (!nodes2 || nodes2.unavailable)
      return [
        {
          kind: 'comparisonUnavailable',
          widget: classic.target,
          detail: `${where}: Nodes 2.0 ${nodes2?.unavailable ?? 'has no recorded probe'}`
        }
      ]
    if (!responded(nodes2))
      return [
        {
          kind: 'noResponse',
          widget: classic.target,
          detail: `${where}: classic ${describeResponse(classic)}; Nodes 2.0 nothing`
        }
      ]
    const sameChanges =
      JSON.stringify(
        classic.changed
          .toSorted()
          .map((key) => [key, classic.transitions?.[key]])
      ) ===
        JSON.stringify(
          nodes2.changed
            .toSorted()
            .map((key) => [key, nodes2.transitions?.[key]])
        ) && classic.popup === nodes2.popup
    return sameChanges
      ? []
      : [
          {
            kind: 'differentResponse',
            widget: classic.target,
            detail: `${where}: classic ${describeResponse(classic)}; Nodes 2.0 ${describeResponse(nodes2)}`
          }
        ]
  })
}

function drawingFindings(
  drawing: HookDrawing | null,
  nodes2: NodeMeasure
): LayoutFinding[] {
  if (!drawing || drawing.distinctPixels < MIN_DRAWN_PIXELS) return []
  if (nodes2.drawCalls !== 0) return []
  if (nodes2.drawingFound === null)
    return [
      {
        kind: 'comparisonUnavailable',
        widget: '(node drawing)',
        detail: 'Spatial drawing evidence unavailable; rerun collection'
      }
    ]
  const found = nodes2.drawingFound
  return found < drawing.distinctPixels * MIN_FOUND_SHARE
    ? [{ kind: 'drawingMissing', pixels: drawing.distinctPixels, found }]
    : []
}

export function layoutFindings(node: SurveyedNode): LayoutFinding[] {
  const { classic, nodes2 } = node
  if (!classic.rendered || !classic.rect)
    return [
      {
        kind: 'classicUnavailable',
        detail:
          classic.errors.join('; ') ||
          'Classic did not render; no comparison was possible'
      }
    ]
  if (!nodes2.rendered || !nodes2.rect) return [{ kind: 'notRendered' }]
  const newErrors = nodes2.errors.filter(
    (message) => !classic.errors.includes(message)
  )
  return [
    ...sizeFindings(classic.rect, nodes2.rect),
    ...widgetFindings(classic.widgets, nodes2.widgets),
    ...(nodes2.overflow >= MIN_OVERFLOW_PX
      ? [{ kind: 'overflow' as const, pixels: nodes2.overflow }]
      : []),
    ...drawingFindings(classic.drawing, nodes2),
    ...newErrors.map((message) => ({ kind: 'error' as const, message })),
    ...probeFindings(node.probes)
  ]
}

const FINDING_LABELS: Record<LayoutFinding['kind'], string> = {
  notRendered: 'Not rendered',
  classicUnavailable: 'Classic control unavailable',
  comparisonUnavailable: 'Comparison unavailable',
  tooBig: 'Too big',
  tooSmall: 'Too small',
  hidden: 'Control hidden',
  covered: 'Control covered',
  clipped: 'Drawing clipped',
  overflow: 'Content cut off',
  drawingMissing: 'Node drawing missing',
  error: 'Error',
  noResponse: 'Control does nothing',
  differentResponse: 'Control behaves differently'
}

function findingText(finding: LayoutFinding) {
  const label = FINDING_LABELS[finding.kind]
  switch (finding.kind) {
    case 'notRendered':
      return label
    case 'tooBig':
    case 'tooSmall':
    case 'classicUnavailable':
      return `${label}: ${finding.detail}`
    case 'hidden':
      return `${label}: ${finding.widget}`
    case 'covered':
      return `${label}: ${finding.widget}${finding.by ? `, under ${finding.by}` : ''}`
    case 'clipped':
      return `${label}: ${finding.widget} (${finding.pixels} px outside its row)`
    case 'overflow':
      return `${label}: ${finding.pixels} px`
    case 'drawingMissing':
      return `${label}: on classic the pack's node draw hook adds ${finding.pixels} distinct-colour px; Nodes 2.0 does not call the hook and spatially matches ${finding.found} of those px`
    case 'error':
      return `${label}: ${finding.message}`
    case 'noResponse':
    case 'differentResponse':
    case 'comparisonUnavailable':
      return `${label}: ${finding.widget}, ${finding.detail}`
  }
}

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

function imageCell(image: string | null) {
  return image
    ? `<td><img src="${escapeHtml(image)}" alt=""></td>`
    : '<td>no image</td>'
}

function nodeRow(node: SurveyedNode, findings: LayoutFinding[]) {
  const list = findings
    .map((finding) => `<li>${escapeHtml(findingText(finding))}</li>`)
    .join('')
  return `<tr><td><b>${escapeHtml(node.type)}</b><ul>${list}</ul></td>${imageCell(node.classic.image)}${imageCell(node.nodes2.image)}</tr>`
}

function packSection({
  data,
  flagged
}: {
  data: LayoutData
  flagged: { node: SurveyedNode; findings: LayoutFinding[] }[]
}) {
  const rows = flagged.map(({ node, findings }) => nodeRow(node, findings))
  const table = rows.length
    ? `<table><tr><th>Node and differences</th><th>Litegraph</th><th>Nodes 2.0</th></tr>${rows.join('')}</table>`
    : ''
  const unavailable = data.nodes.filter(
    (node) => !node.classic.rendered || !node.classic.rect
  ).length
  const measured = data.nodes.filter(
    (node) =>
      node.classic.rendered &&
      node.classic.rect &&
      node.nodes2.rendered &&
      node.nodes2.rect
  ).length
  return `<h2>${escapeHtml(data.pack)}</h2><p>${flagged.length} of ${data.nodes.length} node types flagged · Measured pairs: ${measured} · Classic controls unavailable: ${unavailable} · commit ${escapeHtml(data.commit)}</p>${table}`
}

export function renderLayoutGallery(packs: LayoutData[]) {
  const sorted = packs
    .toSorted((a, b) => a.pack.localeCompare(b.pack))
    .map((data) => ({
      data,
      flagged: data.nodes
        .map((node) => ({ node, findings: layoutFindings(node) }))
        .filter(({ findings }) => findings.length > 0)
    }))
  const flaggedTotal = sorted.reduce(
    (sum, { flagged }) => sum + flagged.length,
    0
  )
  const nodeTotal = sorted.reduce((sum, { data }) => sum + data.nodes.length, 0)
  return `<!doctype html><html><head><meta charset="utf-8"><title>Nodes 2.0 layout survey</title><style>body{font:12pt sans-serif;margin:24px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;vertical-align:top;text-align:left}img{max-width:520px}</style></head><body><h1>Nodes 2.0 layout survey</h1><p>Node types available and registered in the reduced test backend, added on Litegraph and on Nodes 2.0 at zoom 1. ${flaggedTotal} of ${nodeTotal} node types are flagged, including unavailable comparisons. Each flag is a measurement or collection limitation; the screenshots are there to confirm it.</p>${sorted.map(packSection).join('')}</body></html>`
}
