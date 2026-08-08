import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n, te } from '@/i18n'
import type * as LiteGraphModule from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import NodeTooltip from './NodeTooltip.vue'

type HitTest = (
  node: MockNode,
  x: number,
  y: number,
  offset: [number, number]
) => number

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
  node_over: MockNode | null
  getWidgetAtCursor: () => MockWidget | null
}

const mockIsOverNodeInput = vi.hoisted(() => vi.fn<HitTest>())
const mockIsOverNodeOutput = vi.hoisted(() => vi.fn<HitTest>())
const mockIsDOMWidget = vi.hoisted(() =>
  vi.fn<(widget: MockWidget) => boolean>()
)
const mockCanvas = vi.hoisted(
  (): MockCanvas => ({
    mouse: [100, 80],
    graph_mouse: [10, 10],
    node_over: null,
    getWidgetAtCursor: vi.fn<() => MockWidget | null>()
  })
)

vi.mock('@/lib/litegraph/src/litegraph', async (importOriginal) => {
  const actual = await importOriginal<typeof LiteGraphModule>()
  return {
    ...actual,
    isOverNodeInput: mockIsOverNodeInput,
    isOverNodeOutput: mockIsOverNodeOutput
  }
})

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: mockCanvas
  }
}))

vi.mock('@/scripts/domWidget', () => ({
  isDOMWidget: mockIsDOMWidget
}))

const jsonTooltip =
  'Positive point prompts as JSON [{"x": int, "y": int}, ...] (pixel coords)'

const positiveCoordsTooltipKey =
  'nodeDefs.SAM3_Detect.inputs.positive_coords.tooltip'

const outputTooltipKey = 'nodeDefs.SAM3_Detect.outputs.0.tooltip'

const sam3DetectNodeDef: ComfyNodeDef = {
  name: 'SAM3_Detect',
  display_name: 'SAM3 Detect',
  category: 'detection/',
  python_module: 'comfy_extras.nodes_sam3',
  description: '',
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
    vi.useFakeTimers()
    vi.resetAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))

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
    mockCanvas.node_over = createSam3Node()
    vi.mocked(mockCanvas.getWidgetAtCursor).mockReturnValue(null)
    vi.mocked(mockIsOverNodeInput).mockReturnValue(-1)
    vi.mocked(mockIsOverNodeOutput).mockReturnValue(-1)
    vi.mocked(mockIsDOMWidget).mockReturnValue(false)

    useNodeDefStore().addNodeDef(sam3DetectNodeDef)
    mergeOutputTooltipMessage(jsonTooltip)
  })

  afterEach(() => {
    mergeOutputTooltipMessage(null)
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows input slot JSON tooltips without i18n placeholder errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(mockIsOverNodeInput).mockReturnValue(0)

    await renderAndHoverCanvas()

    expect(te(positiveCoordsTooltipKey)).toBe(true)
    expect(screen.getByText(jsonTooltip)).toBeInTheDocument()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('shows output slot JSON tooltips without i18n placeholder errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(mockIsOverNodeOutput).mockReturnValue(0)

    await renderAndHoverCanvas()

    expect(te(outputTooltipKey)).toBe(true)
    expect(screen.getByText(jsonTooltip)).toBeInTheDocument()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('shows widget JSON tooltips without i18n placeholder errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(mockCanvas.getWidgetAtCursor).mockReturnValue({
      name: 'positive_coords'
    })

    await renderAndHoverCanvas()

    expect(te(positiveCoordsTooltipKey)).toBe(true)
    expect(screen.getByText(jsonTooltip)).toBeInTheDocument()
    expect(consoleError).not.toHaveBeenCalled()
  })
})
