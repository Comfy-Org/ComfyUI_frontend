import { fireEvent, render, screen } from '@testing-library/vue'
import { cloneDeep } from 'es-toolkit'
import userEvent from '@testing-library/user-event'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, mergeCustomNodesI18n } from '@/i18n'
import {
  LGraphNode,
  isOverNodeInput,
  isOverNodeOutput
} from '@comfyorg/litegraph/litegraph'
import type { LGraphCanvas } from '@comfyorg/litegraph/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@comfyorg/settings-core/types'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import NodeTooltip from './NodeTooltip.vue'

const enMessages = cloneDeep(i18n.global.getLocaleMessage('en'))
type HitTest = typeof isOverNodeInput

interface MockWidget {
  name: string
  tooltip?: string
}

interface MockNode {
  type: string
  flags: {
    collapsed?: boolean
    ghost?: boolean
  }
  pos: [number, number]
  inputs: Array<{ name: string }>
  constructor: {
    title_mode?: 0 | 1 | 2 | 3
  }
}

interface MockCanvas {
  mouse: [number, number]
  graph_mouse: [number, number]
  graph: { getNodeOnPos: () => MockNode | null }
  linkConnector: { isConnecting: boolean }
  node_widget?: LGraphCanvas['node_widget']
  node_over: MockNode | null
  getWidgetAtCursor: () => MockWidget | null
}

const mockIsOverNodeInput = vi.hoisted(() => vi.fn<HitTest>())
const mockIsOverNodeOutput = vi.hoisted(() => vi.fn<HitTest>())
const mockIsDOMWidget = vi.hoisted(() =>
  vi.fn<(widget: MockWidget) => boolean>()
)
const mockCanvas = vi.hoisted((): MockCanvas => ({
  mouse: [100, 80],
  graph_mouse: [10, 10],
  graph: { getNodeOnPos: vi.fn(() => mockCanvas.node_over) },
  linkConnector: { isConnecting: false },
  node_over: null,
  getWidgetAtCursor: vi.fn<() => MockWidget | null>()
}))

vi.mock(import('@comfyorg/litegraph/litegraph'), { spy: true })

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    canvas: mockCanvas
  }
}))

vi.mock<unknown>(import('@/scripts/domWidget'), () => ({
  isDOMWidget: mockIsDOMWidget
}))

const jsonTooltip =
  'Positive point prompts as JSON [{"x": int, "y": int}, ...] (pixel coords)'

const sam3DetectNodeDef: ComfyNodeDef = {
  name: 'SAM3_Detect',
  display_name: 'SAM3 Detect',
  category: 'detection/',
  python_module: 'comfy_extras.nodes_sam3',
  description: 'Frontend description',
  input: {
    required: {},
    optional: {
      positive_coords: [
        'STRING',
        {
          tooltip: jsonTooltip,
          forceInput: true
        }
      ]
    }
  },
  output: ['MASK'],
  output_name: ['masks'],
  output_tooltips: [jsonTooltip],
  output_node: false,
  deprecated: false,
  experimental: false
}

function createSam3Node(): MockNode {
  return {
    type: 'SAM3_Detect',
    flags: {},
    pos: [0, 0],
    inputs: [{ name: 'positive_coords' }],
    constructor: {}
  }
}

function mergeOutputTooltipMessage(tooltip: string | null) {
  i18n.global.mergeLocaleMessage('en', {
    nodeDefs: {
      SAM3_Detect: {
        outputs: {
          0: {
            tooltip
          }
        }
      }
    }
  })
}

function mergeInputTooltipMessage(tooltip: string | null) {
  i18n.global.mergeLocaleMessage('en', {
    nodeDefs: {
      SAM3_Detect: { inputs: { positive_coords: { tooltip } } }
    }
  })
}

async function renderAndHoverCanvas() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  render(NodeTooltip)

  const canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  await user.hover(canvas)
  await vi.runOnlyPendingTimersAsync()
  await nextTick()
}

describe('NodeTooltip', () => {
  beforeEach(() => {
    vi.mocked(isOverNodeInput).mockImplementation(mockIsOverNodeInput)
    vi.mocked(isOverNodeOutput).mockImplementation(mockIsOverNodeOutput)
    vi.spyOn(useSettingStore(), 'get').mockImplementation(
      <K extends keyof Settings>(key: K): Settings[K] => {
        switch (key) {
          case 'LiteGraph.Node.TooltipDelay':
            return 0 as Settings[K]
          default:
            return undefined as Settings[K]
        }
      }
    )

    mockCanvas.mouse = [100, 80]
    mockCanvas.graph_mouse = [10, 10]
    mockCanvas.linkConnector.isConnecting = false
    mockCanvas.node_widget = null
    mockCanvas.node_over = createSam3Node()
    vi.mocked(mockCanvas.getWidgetAtCursor).mockReturnValue(null)
    vi.mocked(mockIsOverNodeInput).mockReturnValue(-1)
    vi.mocked(mockIsOverNodeOutput).mockReturnValue(-1)
    vi.mocked(mockIsDOMWidget).mockReturnValue(false)

    useNodeDefStore().addNodeDef(sam3DetectNodeDef)
    mergeOutputTooltipMessage(jsonTooltip)
  })

  afterEach(() => {
    mergeCustomNodesI18n({})
    i18n.global.setLocaleMessage('en', cloneDeep(enMessages))
  })

  it('resolves the node description shown over the title', async () => {
    mergeCustomNodesI18n({
      en: {
        nodeDefs: {
          SAM3_Detect: { description: 'Localized description' }
        }
      }
    })
    mockCanvas.graph_mouse[1] = -1

    await renderAndHoverCanvas()

    expect(screen.getByText('Localized description')).toBeInTheDocument()
  })

  it.for(['pointerdown', 'wheel'] as const)(
    'cancels a pending canvas hint on %s',
    async (event) => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      vi.mocked(useSettingStore().get).mockReturnValue(2500)
      vi.mocked(mockIsOverNodeInput).mockReturnValue(0)
      render(NodeTooltip)
      const canvas = document.createElement('canvas')
      document.body.appendChild(canvas)

      await user.hover(canvas)
      await fireEvent(canvas, new Event(event, { bubbles: true }))
      await vi.advanceTimersByTimeAsync(3000)

      expect(screen.queryByText(jsonTooltip)).not.toBeInTheDocument()
    }
  )

  it('requires a long press for canvas hints on touch and hides them on release', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.mocked(useSettingStore().get).mockReturnValue(2500)
    vi.mocked(mockIsOverNodeInput).mockReturnValue(0)
    vi.mocked(mockCanvas.graph.getNodeOnPos).mockReturnValue(createSam3Node())
    mockCanvas.node_over = null
    render(NodeTooltip)
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)

    await user.pointer({ keys: '[TouchA]', target: canvas })
    await vi.advanceTimersByTimeAsync(3000)
    expect(screen.queryByText(jsonTooltip)).not.toBeInTheDocument()

    await user.pointer({ keys: '[TouchA>]', target: canvas })
    await vi.advanceTimersByTimeAsync(1499)
    expect(screen.queryByText(jsonTooltip)).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)
    expect(screen.getByText(jsonTooltip)).toBeVisible()
    await user.pointer({ keys: '[/TouchA]', target: canvas })
    expect(screen.queryByText(jsonTooltip)).not.toBeInTheDocument()
  })

  it('suppresses a stationary touch hint while connecting a slot', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.mocked(mockIsOverNodeOutput).mockReturnValue(0)
    mockCanvas.linkConnector.isConnecting = true
    render(NodeTooltip)
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)

    await user.pointer({ keys: '[TouchA>]', target: canvas })
    await vi.advanceTimersByTimeAsync(1600)

    expect(screen.queryByText(jsonTooltip)).not.toBeInTheDocument()
  })

  it.for([
    { elapsed: 0, movement: 1, hintCount: 0 },
    { elapsed: 1500, movement: 1, hintCount: 0 },
    { elapsed: 0, movement: 0, hintCount: 1 }
  ])(
    'shows $hintCount touch widget hints after moving $movement px at $elapsed ms',
    async ({ elapsed, movement, hintCount }) => {
      vi.useFakeTimers({ shouldAdvanceTime: false })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const node = new LGraphNode('Widget test')
      const widget = node.addWidget('number', 'steps', 20, () => {}, {})
      vi.mocked(mockCanvas.getWidgetAtCursor).mockReturnValue({
        name: 'steps',
        tooltip: 'Widget hint'
      })
      render(NodeTooltip)
      const canvas = document.createElement('canvas')
      document.body.appendChild(canvas)

      await user.pointer({
        keys: '[TouchA>]',
        target: canvas,
        coords: { clientX: 100, clientY: 80 }
      })
      mockCanvas.node_widget = [node, widget]
      await vi.advanceTimersByTimeAsync(elapsed)
      await user.pointer({
        pointerName: 'TouchA',
        coords: { clientX: 100 + movement, clientY: 80 }
      })
      await vi.advanceTimersByTimeAsync(1600)

      expect(screen.queryAllByText('Widget hint')).toHaveLength(hintCount)
    }
  )

  it('shows input slot JSON tooltips without i18n placeholder errors', async () => {
    vi.mocked(mockIsOverNodeInput).mockReturnValue(0)

    await renderAndHoverCanvas()

    expect(screen.getByText(jsonTooltip)).toBeInTheDocument()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('shows output slot JSON tooltips without i18n placeholder errors', async () => {
    vi.mocked(mockIsOverNodeOutput).mockReturnValue(0)

    await renderAndHoverCanvas()

    expect(screen.getByText(jsonTooltip)).toBeInTheDocument()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('shows widget JSON tooltips without i18n placeholder errors', async () => {
    vi.mocked(mockCanvas.getWidgetAtCursor).mockReturnValue({
      name: 'positive_coords'
    })

    await renderAndHoverCanvas()

    expect(screen.getByText(jsonTooltip)).toBeInTheDocument()
    expect(console.error).not.toHaveBeenCalled()
  })

  describe('when the bundled snapshot has gone stale', () => {
    const staleInputTooltip = 'stale bundled input tooltip'
    const staleOutputTooltip = 'stale bundled output tooltip'

    beforeEach(() => {
      mergeInputTooltipMessage(staleInputTooltip)
      mergeOutputTooltipMessage(staleOutputTooltip)
    })

    it('shows the live backend input slot tooltip', async () => {
      vi.mocked(mockIsOverNodeInput).mockReturnValue(0)

      await renderAndHoverCanvas()

      expect(screen.getByText(jsonTooltip)).toBeInTheDocument()
      expect(screen.queryByText(staleInputTooltip)).not.toBeInTheDocument()
    })

    it('shows the live backend output slot tooltip', async () => {
      vi.mocked(mockIsOverNodeOutput).mockReturnValue(0)

      await renderAndHoverCanvas()

      expect(screen.getByText(jsonTooltip)).toBeInTheDocument()
      expect(screen.queryByText(staleOutputTooltip)).not.toBeInTheDocument()
    })
  })
})
