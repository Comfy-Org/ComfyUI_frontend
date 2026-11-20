import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import { appTooltipProviderDefaults } from '@comfyorg/design-system/lib/tooltip/tooltipConfig'
import SelectionToolbox from '@/components/graph/SelectionToolbox.vue'
import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import commands from '@/locales/en/commands.json'
import en from '@/locales/en/main.json'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@comfyorg/telemetry'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCanvasInteractions } from '@/renderer/core/canvas/useCanvasInteractions'
import { useExtensionService } from '@/platform/extensions/services/extensionService'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { usePropertiesPanelStore } from '@/renderer/extensions/propertiesPanel/propertiesPanelStore'
import { createMockCanvas } from '@/utils/__tests__/canvasTestUtils'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'
import {
  clearEscapeOverrides,
  consultEscapeOverride
} from '@/platform/keybindings/escapeOverride'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

vi.mock(import('@/renderer/core/canvas/useCanvasInteractions'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/extensions/services/extensionService'), () => {
  const service: ReturnType<typeof useExtensionService> = {
    registerExtension: vi.fn(),
    registerExtensionNow: vi.fn(),
    invokeExtensions: vi.fn(() => []),
    invokeExtensionsAsync: vi.fn(async () => []),
    invokeStartupHook: vi.fn(async () => [])
  }
  return { useExtensionService: () => service }
})
vi.mock(import('@/utils/litegraphUtil'))
const askAgentAboutNodes = vi.hoisted(() => vi.fn())
vi.mock(
  import('@/workbench/extensions/agent/composables/agent/useAskAgentAboutNodes'),
  () => ({
    useAskAgentAboutNodes: () => ({
      canAskAgent: computed(() => true),
      askAgentAboutNodes
    })
  })
)
vi.mock(import('@/composables/canvas/useSelectionToolboxPosition'), () => ({
  useSelectionToolboxPosition: () => ({ visible: computed(() => true) }),
  resetMoreOptionsState: vi.fn()
}))

const nodeDef = new ComfyNodeDefImpl({
  name: 'TestNode',
  display_name: 'Test Node',
  category: 'test',
  input: {},
  output: [],
  output_name: [],
  output_is_list: [],
  output_node: false,
  python_module: 'nodes',
  description: ''
})

function renderToolbox() {
  return render(SelectionToolbox, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: { ...en, commands } }
        })
      ],
      stubs: {
        TidyUpButton: true,
        AlignButton: true,
        ColorPickerButton: {
          template: '<button aria-label="Color" />'
        },
        ExecuteButton: {
          template: '<button aria-label="Execute to selected output nodes" />'
        }
      }
    }
  })
}

describe('SelectionToolbox', () => {
  beforeEach(() => {
    useCanvasStore().canvas = createMockCanvas()
    vi.spyOn(usePropertiesPanelStore(), 'openPanel').mockReturnValue(true)
    vi.mocked(useNodeDefStore().fromLGraphNode).mockReturnValue(nodeDef)
    vi.mocked(useExtensionService().invokeExtensions).mockReturnValue([])
    useSettingStore().$patch({
      settingValues: {
        'Comfy.UseNewMenu': 'Top',
        'Comfy.Load3D.3DViewerEnable': true
      }
    })
  })

  it('updates actions when selection changes without remounting', async () => {
    setCanvasSelection([new LGraphNode('Test Node')])
    renderToolbox()
    expect(
      screen.getByRole('button', { name: 'Node Info' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete Selected Items' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Convert Selection to Subgraph'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Bypass/Unbypass Selected Nodes'
      })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Color' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Frame Nodes' })).toBeNull()
    expect(screen.getAllByRole('separator')).toHaveLength(2)

    setCanvasSelection([new LGraphNode('A'), new LGraphNode('B')])
    await nextTick()
    expect(screen.queryByRole('button', { name: 'Node Info' })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Frame Nodes' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Color' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Bypass/Unbypass Selected Nodes'
      })
    ).toBeInTheDocument()

    setCanvasSelection([])
    await nextTick()
    expect(screen.getAllByRole('button')).toEqual([
      screen.getByRole('button', { name: 'More Options' })
    ])
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })

  it.for([
    { menu: 'Top', visible: true },
    { menu: 'Disabled', visible: false }
  ] as const)('info visibility with menu $menu', ({ menu, visible }) => {
    useSettingStore().$patch({
      settingValues: {
        'Comfy.UseNewMenu': menu
      }
    })
    setCanvasSelection([new LGraphNode('Test Node')])
    renderToolbox()
    expect(screen.queryByRole('button', { name: 'Node Info' }) !== null).toBe(
      visible
    )
  })

  it('hides info without a node definition', () => {
    vi.mocked(useNodeDefStore().fromLGraphNode).mockReturnValue(null)
    setCanvasSelection([new LGraphNode('Unknown')])
    renderToolbox()
    expect(screen.queryByRole('button', { name: 'Node Info' })).toBeNull()
  })

  it('opens info and tracks a successful click', async () => {
    setCanvasSelection([new LGraphNode('Test Node')])
    renderToolbox()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Node Info' }))
    expect(usePropertiesPanelStore().openPanel).toHaveBeenCalledWith('info')
    expect(useTelemetry()?.trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'selection_toolbox_node_info_opened',
      element_group: 'selection_toolbox'
    })
  })

  it.for([
    [
      'Bypass/Unbypass Selected Nodes',
      'Comfy.Canvas.ToggleSelectedNodes.Bypass'
    ],
    ['Delete Selected Items', 'Comfy.Canvas.DeleteSelectedItems'],
    ['Convert Selection to Subgraph', 'Comfy.Graph.ConvertToSubgraph']
  ])('routes %s through the command store', async ([name, commandId]) => {
    const action = vi.fn()
    useCommandStore().registerCommand({ id: commandId, function: action })
    setCanvasSelection([new LGraphNode('Test Node')])
    renderToolbox()
    await userEvent.setup().click(screen.getByRole('button', { name }))
    expect(action).toHaveBeenCalledOnce()
  })

  it('keeps protected selections undeletable', async () => {
    const node = new LGraphNode('Protected')
    node.removable = false
    setCanvasSelection([node])
    renderToolbox()
    expect(
      screen.queryByRole('button', {
        name: 'Delete Selected Items'
      })
    ).toBeNull()
    setCanvasSelection([node, new LGraphNode('Removable')])
    await nextTick()
    expect(
      screen.getByRole('button', { name: 'Delete Selected Items' })
    ).toBeInTheDocument()
  })

  it('offers the mask editor for a single image and routes its command', async () => {
    const node = new LGraphNode('Image')
    node.previewMediaType = 'image'
    const action = vi.fn()
    useCommandStore().registerCommand({
      id: 'Comfy.MaskEditor.OpenMaskEditor',
      function: action
    })
    setCanvasSelection([node])
    renderToolbox()
    await userEvent.setup().click(
      screen.getByRole('button', {
        name: 'Open Mask Editor for Selected Node'
      })
    )
    expect(action).toHaveBeenCalledOnce()
    setCanvasSelection([new LGraphNode('Other')])
    await nextTick()
    expect(
      screen.queryByRole('button', {
        name: 'Open Mask Editor for Selected Node'
      })
    ).toBeNull()
  })

  it('offers the 3D viewer only for a Load3D selection', async () => {
    setCanvasSelection([new LGraphNode('3D', 'Load3D')])
    renderToolbox()
    expect(
      screen.getByRole('button', {
        name: 'Open 3D Viewer (Beta) for Selected Node'
      })
    ).toBeInTheDocument()
    setCanvasSelection([new LGraphNode('Other')])
    await nextTick()
    expect(
      screen.queryByRole('button', {
        name: 'Open 3D Viewer (Beta) for Selected Node'
      })
    ).toBeNull()
  })

  it('offers execution only when output nodes are selected', async () => {
    class OutputNode extends LGraphNode {
      static override nodeData = { output_node: true }
    }
    setCanvasSelection([new OutputNode('Output')])
    renderToolbox()
    expect(
      screen.getByRole('button', { name: 'Execute to selected output nodes' })
    ).toBeInTheDocument()
    setCanvasSelection([new LGraphNode('Other')])
    await nextTick()
    expect(
      screen.queryByRole('button', { name: 'Execute to selected output nodes' })
    ).toBeNull()
  })

  it.for([
    {
      id: 'Comfy.Graph.UnpackSubgraph',
      label: 'Untranslated command label',
      expectedLabel: 'Unpack the selected Subgraph'
    },
    {
      id: 'Test.ExtensionCommand',
      label: () => 'Extension action',
      expectedLabel: 'Extension action'
    }
  ])(
    'renders and executes deduplicated command $id',
    async ({ id, label, expectedLabel }) => {
      const action = vi.fn()
      useCommandStore().registerCommand({
        id,
        label,
        function: action,
        icon: () => 'icon-[lucide--star]'
      })
      vi.mocked(useExtensionService().invokeExtensions).mockReturnValue([
        id,
        id,
        'Unknown.Command'
      ])
      setCanvasSelection([new LGraphNode('Test Node')])
      renderToolbox()
      expect(
        screen.getAllByRole('button', {
          name: expectedLabel
        })
      ).toHaveLength(1)
      await userEvent.setup().click(
        screen.getByRole('button', {
          name: expectedLabel
        })
      )
      expect(action).toHaveBeenCalledOnce()
    }
  )

  it('forwards wheel events to the canvas', async () => {
    setCanvasSelection([new LGraphNode('Test Node')])
    renderToolbox()
    await fireEvent.wheel(screen.getByTestId('selection-toolbox'))
    expect(useCanvasInteractions().forwardEventToCanvas).toHaveBeenCalledOnce()
  })

  it('waits for deliberate hover before showing a tooltip over the canvas', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    setCanvasSelection([new LGraphNode('Test Node')])
    renderToolbox()
    await user.hover(screen.getByRole('button', { name: 'More Options' }))
    await vi.advanceTimersByTimeAsync(
      appTooltipProviderDefaults.delayDuration - 1
    )
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(1)
    expect(screen.getByTestId('tooltip-content')).toHaveTextContent(
      'More Options'
    )
  })
})

describe('SelectionToolbox Ask agent', () => {
  beforeEach(() => {
    clearEscapeOverrides()
    useCanvasStore().canvas = createMockCanvas({
      canvas: document.createElement('canvas')
    })
    vi.mocked(useNodeDefStore().fromLGraphNode).mockReturnValue(nodeDef)
    askAgentAboutNodes.mockClear()
  })

  function nodes(count: number, type = 'KSampler'): LGraphNode[] {
    return Array.from({ length: count }, (_, index) => {
      const node = new LGraphNode(`Node ${index}`)
      node.type = type
      return node
    })
  }

  it('shows no Ask agent button while the agent is off', () => {
    setCanvasSelection(nodes(1))
    renderToolbox()
    expect(screen.queryByRole('button', { name: 'Ask agent' })).toBeNull()
  })

  it('turns the toolbar into the composer and tracks the button click', async () => {
    const trackUiButtonClicked = vi.fn()
    vi.mocked(useTelemetry).mockReturnValue({
      trackUiButtonClicked
    } as unknown as ReturnType<typeof useTelemetry>)
    useAgentPanelStore().enabled = true
    setCanvasSelection(nodes(1))
    renderToolbox()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Ask agent' }))

    expect(screen.queryByRole('button', { name: 'Ask agent' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More Options' })).toBeNull()
    expect(
      screen.getByRole('list', { name: 'Example prompts' })
    ).toBeInTheDocument()
    expect(trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'selection_toolbox_ask_agent_opened',
      element_group: 'selection_toolbox'
    })
  })

  it('opens the composer with example prompts for one node and keeps them visible while typing', async () => {
    useAgentPanelStore().enabled = true
    setCanvasSelection(nodes(1))
    renderToolbox()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Ask agent' }))

    const input = screen.getByRole('textbox', {
      name: 'Ask about the selected nodes'
    })
    expect(input).toHaveFocus()
    expect(
      screen
        .getAllByRole('button', { name: /\?$|settings$/ })
        .map((button) => button.textContent.trim())
    ).toEqual([
      'What does this node do?',
      'Explain these settings',
      'Suggest better settings'
    ])

    await user.type(input, 'Why are faces soft?')
    expect(
      screen.getByRole('list', { name: 'Example prompts' })
    ).toBeInTheDocument()
  })

  it('offers media prompts for a Load Image node', async () => {
    useAgentPanelStore().enabled = true
    setCanvasSelection(nodes(1, 'LoadImage'))
    renderToolbox()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Ask agent' }))

    expect(
      screen.getByRole('button', { name: 'Upscale this' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Edit this image' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Animate this' })
    ).toBeInTheDocument()
  })

  it('offers the multiple-node prompts for three nodes', async () => {
    useAgentPanelStore().enabled = true
    setCanvasSelection(nodes(3))
    renderToolbox()

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Ask agent' }))

    expect(
      screen.getByRole('button', { name: 'How do these connect?' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Combine these into one workflow' })
    ).toBeInTheDocument()
  })

  it('asks about the selection from an example prompt with suggestion input method and closes', async () => {
    useAgentPanelStore().enabled = true
    const selection = nodes(1)
    setCanvasSelection(selection)
    renderToolbox()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Ask agent' }))
    await user.click(
      screen.getByRole('button', { name: 'Explain these settings' })
    )

    expect(askAgentAboutNodes).toHaveBeenCalledWith(
      'Explain these settings',
      selection,
      'selection_toolbox_suggestion'
    )
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('sends a typed question on Enter with selection_toolbox input method and closes', async () => {
    useAgentPanelStore().enabled = true
    const selection = nodes(1)
    setCanvasSelection(selection)
    renderToolbox()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Ask agent' }))
    await user.type(screen.getByRole('textbox'), 'Why is it slow?{Enter}')

    expect(askAgentAboutNodes).toHaveBeenCalledWith(
      'Why is it slow?',
      selection,
      'selection_toolbox'
    )
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('closes on Escape from both input and focused example prompt buttons without bubbling', async () => {
    useAgentPanelStore().enabled = true
    setCanvasSelection(nodes(1))
    renderToolbox()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Ask agent' }))
    const exampleButton = screen.getByRole('button', {
      name: 'Explain these settings'
    })
    exampleButton.focus()
    await user.keyboard('{Escape}')

    expect(askAgentAboutNodes).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('claims bare Escape via escape override while open so subgraphs do not exit', async () => {
    useAgentPanelStore().enabled = true
    setCanvasSelection(nodes(1))
    renderToolbox()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Ask agent' }))
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      cancelable: true
    })
    expect(consultEscapeOverride(event)).toBe(true)
    await nextTick()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('closes on outside pointerdown or selection change without asking', async () => {
    useAgentPanelStore().enabled = true
    setCanvasSelection(nodes(1))
    renderToolbox()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Ask agent' }))
    await user.pointer({ keys: '[MouseLeft>]', target: document.body })
    expect(screen.queryByRole('textbox')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Ask agent' }))
    setCanvasSelection(nodes(2))
    await nextTick()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(askAgentAboutNodes).not.toHaveBeenCalled()
  })
})
