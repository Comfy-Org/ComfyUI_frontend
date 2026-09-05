import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ContextMenuDivElement,
  IContextMenuValue
} from '@/lib/litegraph/src/interfaces'
import type {
  LGraph,
  LGraphCanvas,
  LGraphGroup,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'
import type { ComfyExtension } from '@/types/comfy'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

const { registerExtension } = vi.hoisted(() => ({
  registerExtension: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: { registerExtension }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => 10 })
}))

import '@/extensions/core/groupOptions'

const ext = registerExtension.mock.calls[0]?.[0] as ComfyExtension

const graphChange = vi.fn()

function makeNode(mode: LGraphEventMode): LGraphNode {
  return createMockLGraphNode({
    mode,
    graph: fromPartial<LGraph>({ change: graphChange })
  })
}

function makeGroup(nodes: LGraphNode[]): LGraphGroup {
  return fromPartial<LGraphGroup>({
    nodes,
    children: new Set(),
    recomputeInsideNodes: vi.fn(),
    resizeTo: vi.fn()
  })
}

function makeCanvas(
  group: LGraphGroup | null,
  selectedItems: Set<unknown> = new Set()
): LGraphCanvas {
  return fromPartial<LGraphCanvas>({
    graph: fromPartial({
      getGroupOnPos: () => group,
      add: vi.fn(),
      change: vi.fn()
    }),
    graph_mouse: [0, 0],
    selectedItems,
    selectNodes: vi.fn(),
    canvas: fromPartial({ focus: vi.fn() })
  })
}

function menuFor(canvas: LGraphCanvas): (IContextMenuValue | null)[] {
  return ext.getCanvasMenuItems!.call(ext, canvas)
}

function labels(items: (IContextMenuValue | null)[]): (string | null)[] {
  return items.map((item) => (item ? String(item.content) : null))
}

const BASE_GROUP_ITEMS: (string | null)[] = [
  'Add Selected Nodes To Group',
  null,
  'Fit Group To Nodes',
  'Select Nodes'
]

beforeEach(() => {
  graphChange.mockClear()
})

describe('Comfy.GroupOptions canvas menu', () => {
  it('offers nothing when there is no group and no selection', () => {
    expect(labels(menuFor(makeCanvas(null)))).toEqual([])
  })

  it('offers group creation when there is a selection but no group', () => {
    const canvas = makeCanvas(null, new Set([{}]))
    expect(labels(menuFor(canvas))).toEqual(['Add Group For Selected Nodes'])
  })

  it('offers only the add-to-group item for an empty group', () => {
    const canvas = makeCanvas(makeGroup([]))
    expect(labels(menuFor(canvas))).toEqual(['Add Selected Nodes To Group'])
  })

  it('disables the add-to-group item when nothing is selected', () => {
    const items = menuFor(makeCanvas(makeGroup([])))
    expect(items[0]?.disabled).toBe(true)
  })

  it.for<[name: string, mode: LGraphEventMode, expected: string[]]>([
    [
      'always',
      LGraphEventMode.ALWAYS,
      ['Set Group Nodes to Never', 'Bypass Group Nodes']
    ],
    [
      'never',
      LGraphEventMode.NEVER,
      ['Set Group Nodes to Always', 'Bypass Group Nodes']
    ],
    [
      'bypass',
      LGraphEventMode.BYPASS,
      ['Set Group Nodes to Always', 'Set Group Nodes to Never']
    ],
    [
      'on trigger',
      LGraphEventMode.ON_TRIGGER,
      [
        'Set Group Nodes to Always',
        'Set Group Nodes to Never',
        'Bypass Group Nodes'
      ]
    ]
  ])(
    'omits the current mode when every node is %s',
    ([, mode, expectedModeItems]) => {
      const group = makeGroup([makeNode(mode), makeNode(mode)])
      expect(labels(menuFor(makeCanvas(group)))).toEqual([
        ...BASE_GROUP_ITEMS,
        ...expectedModeItems
      ])
    }
  )

  it('offers every mode when the nodes differ', () => {
    const group = makeGroup([
      makeNode(LGraphEventMode.ALWAYS),
      makeNode(LGraphEventMode.NEVER)
    ])
    expect(labels(menuFor(makeCanvas(group)))).toEqual([
      ...BASE_GROUP_ITEMS,
      'Set Group Nodes to Always',
      'Set Group Nodes to Never',
      'Bypass Group Nodes'
    ])
  })

  it.for<[label: string, expected: LGraphEventMode]>([
    ['Set Group Nodes to Always', LGraphEventMode.ALWAYS],
    ['Set Group Nodes to Never', LGraphEventMode.NEVER],
    ['Bypass Group Nodes', LGraphEventMode.BYPASS]
  ])('applies %s to every node in the group', ([label, expected]) => {
    const nodes = [
      makeNode(LGraphEventMode.ON_TRIGGER),
      makeNode(LGraphEventMode.ON_TRIGGER)
    ]
    const items = menuFor(makeCanvas(makeGroup(nodes)))
    const item = items.find((entry) => entry?.content === label)
    const menuElement: ContextMenuDivElement = document.createElement('div')

    void item?.callback?.call(menuElement)

    expect(nodes.map((node) => node.mode)).toEqual([expected, expected])
    expect(graphChange).toHaveBeenCalledTimes(nodes.length)
  })
})
