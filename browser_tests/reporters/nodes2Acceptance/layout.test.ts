import { describe, expect, it } from 'vitest'

import type {
  HookDrawing,
  LayoutFinding,
  NodeMeasure,
  ProbeOutcome,
  SurveyedNode,
  WidgetMeasure
} from '@e2e/reporters/nodes2Acceptance/layout'
import {
  NODE_BODY,
  layoutFindings,
  renderLayoutGallery
} from '@e2e/reporters/nodes2Acceptance/layout'

function widget(overrides: Partial<WidgetMeasure> = {}): WidgetMeasure {
  return {
    name: 'slider',
    type: 'custom',
    custom: true,
    shownInOwner: false,
    coveredBy: null,
    visible: true,
    reachable: true,
    rect: { x: 0, y: 40, width: 200, height: 20 },
    clippedPixels: 0,
    ...overrides
  }
}

function measure(overrides: Partial<NodeMeasure> = {}): NodeMeasure {
  return {
    rendered: true,
    rect: { x: 0, y: 0, width: 200, height: 100 },
    widgets: [widget()],
    overflow: 0,
    drawing: null,
    drawingFound: null,
    drawCalls: null,
    bodyInteractive: false,
    errors: [],
    image: 'layout/img/pack/0.classic.png',
    ...overrides
  }
}

function hookDrawingOf(distinctPixels: number): HookDrawing {
  return {
    pixels: Math.max(distinctPixels, 500),
    distinctPixels,
    colours: [0xf00],
    box: { x: 180, y: -24, width: 16, height: 16 },
    nodeSize: { width: 200, height: 100 }
  }
}

function probe(overrides: Partial<ProbeOutcome> = {}): ProbeOutcome {
  return {
    target: 'slider',
    x: 0.5,
    y: 0.5,
    changed: [],
    popup: false,
    pixels: 0,
    ...overrides
  }
}

function surveyed(
  classic: Partial<NodeMeasure> = {},
  nodes2: Partial<NodeMeasure> = {},
  probes: Partial<SurveyedNode['probes']> = {}
): SurveyedNode {
  return {
    type: 'Pack Node',
    classic: measure(classic),
    nodes2: measure({ image: 'layout/img/pack/0.nodes2.png', ...nodes2 }),
    probes: { classic: [], nodes2: [], ...probes }
  }
}

const kinds = (node: SurveyedNode) =>
  layoutFindings(node).map((finding) => finding.kind)

describe('layoutFindings', () => {
  it('finds nothing when both renderers draw and respond the same', () => {
    const same = probe({ changed: ['widget slider'], pixels: 300 })

    expect(
      layoutFindings(surveyed({}, {}, { classic: [same], nodes2: [same] }))
    ).toEqual([])
  })

  const flaggedCases: [
    string,
    Partial<NodeMeasure>,
    Partial<NodeMeasure>,
    LayoutFinding['kind']
  ][] = [
    ['a node Nodes 2.0 never renders', {}, { rendered: false }, 'notRendered'],
    [
      'a node more than 1.5x and 40 px wider',
      {},
      { rect: { x: 0, y: 0, width: 320, height: 100 } },
      'tooBig'
    ],
    [
      'a node shorter by a fifth and 20 px',
      {},
      { rect: { x: 0, y: 0, width: 200, height: 70 } },
      'tooSmall'
    ],
    [
      'a control visible on classic but not on Nodes 2.0',
      {},
      { widgets: [widget({ visible: false })] },
      'hidden'
    ],
    [
      'a control something else covers',
      {},
      { widgets: [widget({ reachable: false })] },
      'covered'
    ],
    [
      'a widget drawing that spills out of its strip',
      {},
      { widgets: [widget({ clippedPixels: 400 })] },
      'clipped'
    ],
    ['a widget row past the node edge', {}, { overflow: 12 }, 'overflow'],
    [
      'a hook drawing classic shows and Nodes 2.0 does not',
      { drawing: hookDrawingOf(900) },
      { drawCalls: 0, drawingFound: 0 },
      'drawingMissing'
    ],
    [
      'an error only Nodes 2.0 throws',
      {},
      { errors: ['TypeError: x is undefined'] },
      'error'
    ]
  ]

  it.for(flaggedCases)('flags %s', ([, classic, nodes2, kind]) => {
    expect(kinds(surveyed(classic, nodes2))).toEqual([kind])
  })

  it.for([
    ['the usual row growth', { width: 225, height: 112 }],
    ['a row-pitch increase on a small node', { width: 200, height: 130 }]
  ] as const)('does not flag %s as a size problem', ([, size]) => {
    expect(kinds(surveyed({}, { rect: { x: 0, y: 0, ...size } }))).toEqual([])
  })

  it('does not flag a control Nodes 2.0 shows inside its owner widget', () => {
    const control = widget({
      name: 'control_after_generate',
      shownInOwner: true
    })

    expect(
      kinds(
        surveyed(
          { widgets: [control] },
          { widgets: [{ ...control, visible: false }] }
        )
      )
    ).toEqual([])
  })

  it('reports when a successful classic click has no Nodes 2.0 target', () => {
    expect(
      kinds(
        surveyed(
          {},
          {},
          { classic: [probe({ changed: ['widget slider'] })], nodes2: [] }
        )
      )
    ).toEqual(['comparisonUnavailable'])
  })

  it('compares changed values, not just changed keys', () => {
    expect(
      kinds(
        surveyed(
          {},
          {},
          {
            classic: [
              probe({
                changed: ['widget slider'],
                transitions: { 'widget slider': { before: '0', after: '1' } }
              })
            ],
            nodes2: [
              probe({
                changed: ['widget slider'],
                transitions: { 'widget slider': { before: '0', after: '2' } }
              })
            ]
          }
        )
      )
    ).toEqual(['differentResponse'])
  })

  it('reports an unsuccessful classic control as unavailable', () => {
    expect(kinds(surveyed({ rendered: false }))).toEqual(['classicUnavailable'])
  })

  it('shows intentionally unperformed clicks as unavailable, not a broken control', () => {
    const classic = probe({ changed: ['widget slider'] })
    const nodes2 = probe({
      unavailable:
        'Body point is occupied by a widget; click intentionally skipped'
    })

    expect(
      kinds(surveyed({}, {}, { classic: [classic], nodes2: [nodes2] }))
    ).toEqual(['comparisonUnavailable'])
  })

  it('does not turn missing spatial evidence into a drawing failure', () => {
    expect(
      kinds(
        surveyed(
          { drawing: hookDrawingOf(900) },
          { drawCalls: 0, drawingFound: null }
        )
      )
    ).toEqual(['comparisonUnavailable'])
  })

  it.for([
    ['the pack draws its own Nodes 2.0 version', hookDrawingOf(900), 800],
    ['the hook only uses colours the node already has', hookDrawingOf(0), 0],
    ['the hook draws nothing visible', null, 0]
  ] as const)(
    'does not flag a hook Nodes 2.0 skips when %s',
    ([, drawing, found]) => {
      expect(
        kinds(surveyed({ drawing }, { drawCalls: 0, drawingFound: found }))
      ).toEqual([])
    }
  )

  it('flags a control that responds on classic and does nothing on Nodes 2.0', () => {
    const [finding] = layoutFindings(
      surveyed(
        {},
        {},
        {
          classic: [probe({ changed: ['widget slider'], pixels: 300 })],
          nodes2: [probe()]
        }
      )
    )

    expect(finding).toMatchObject({ kind: 'noResponse', widget: 'slider' })
  })

  it('flags a body click that changes different state on Nodes 2.0', () => {
    const at = { target: NODE_BODY, x: 0.2, y: 0.25 }
    const [finding] = layoutFindings(
      surveyed(
        {},
        {},
        {
          classic: [probe({ ...at, changed: ['property value', 'widget Xi'] })],
          nodes2: [probe({ ...at, changed: ['property value'] })]
        }
      )
    )

    expect(finding).toMatchObject({ kind: 'differentResponse' })
    expect(finding).toHaveProperty(
      'detail',
      expect.stringContaining('20% across, 25% down')
    )
  })
})

describe('renderLayoutGallery', () => {
  it('lists unavailable classic controls separately from measured pairs', () => {
    const html = renderLayoutGallery([
      {
        pack: 'some-pack',
        commit: 'main abc',
        finishedAt: '',
        nodes: [
          surveyed(),
          {
            ...surveyed({ rendered: false, errors: ['Construction failed'] }),
            type: 'Unavailable Classic'
          }
        ]
      }
    ])

    expect(html).toContain(
      'Measured pairs: 1 · Classic controls unavailable: 1'
    )
    expect(html).toMatch(
      /Unavailable Classic<\/b>[\s\S]*?Classic control unavailable: Construction failed/
    )
  })

  it('lists flagged nodes with both screenshots and the flagged count', () => {
    const html = renderLayoutGallery([
      {
        pack: 'some-pack',
        commit: 'main abc',
        finishedAt: '2026-11-23T00:00:00Z',
        nodes: [
          {
            ...surveyed(),
            type: 'Unflagged',
            classic: measure({ image: 'unflagged.png' })
          },
          { ...surveyed({}, { overflow: 12 }), type: 'Flagged Pair' }
        ]
      }
    ])

    expect(html).toContain('1 of 2 node types flagged')
    const row = html.match(/<tr><td><b>Flagged Pair<\/b>[\s\S]*?<\/tr>/)?.[0]
    expect(row).toContain('src="layout/img/pack/0.classic.png"')
    expect(row).toContain('src="layout/img/pack/0.nodes2.png"')
    expect(row).toContain('Content cut off')
    expect(row).not.toContain('unflagged.png')
  })
})
