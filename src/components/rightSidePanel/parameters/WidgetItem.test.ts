import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial, fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { INodeInputSlot } from '@/lib/litegraph/src/types/slots'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import WidgetButton from '@/renderer/extensions/vueNodes/widgets/components/WidgetButton.vue'
import { getComponent } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { useLinkStore } from '@/stores/linkStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetValue } from '@/utils/widgetUtil'
import type { EnhancePromptFn } from '@/workbench/extensions/agent/services/enhancePromptRequest'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'

import WidgetItem from './WidgetItem.vue'

beforeEach(() => {
  useCanvasStore().canvas = fromPartial({ setDirty: vi.fn() })
})

const { StubWidgetComponent } = vi.hoisted(() => ({
  StubWidgetComponent: {
    name: 'StubWidget',
    props: ['widget', 'modelValue', 'nodeId', 'nodeType'],
    template:
      '<div class="stub-widget" :data-widget-options="JSON.stringify(widget?.options)" :data-widget-type="widget?.type" :data-widget-name="widget?.name" :data-widget-value="String(widget?.value)" />'
  }
}))

vi.mock(
  import('@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'),

  () => ({
    getComponent: vi.fn(() => StubWidgetComponent),
    shouldExpand: () => false
  })
)

vi.mock<unknown>(
  import('@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'),

  () => ({
    default: StubWidgetComponent
  })
)

const enhancePromptRequest = vi.hoisted(() =>
  vi.fn<EnhancePromptFn>(async ({ prompt }) => ({
    ok: true,
    prompt: `${prompt} rewritten`
  }))
)

vi.mock(
  import('@/workbench/extensions/agent/services/enhancePromptRequest'),
  () => ({
    enhancePromptRequest
  })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      agent: {
        enhancePrompt: 'Enhance prompt',
        enhancingPrompt: 'Enhancing prompt'
      },
      rightSidePanel: {
        fallbackNodeTitle: 'Untitled'
      }
    }
  }
})

function createMockNode(
  overrides: Partial<LGraphNode> | Record<string, unknown> = {}
): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id: 1,
    type: 'TestNode',
    isSubgraphNode: () => false,
    graph: { id: 'test-graph-id', rootGraph: { id: 'test-graph-id' } },
    ...overrides
  })
}

function createMockWidget(overrides: Partial<IBaseWidget> = {}): IBaseWidget {
  return {
    name: 'test_widget',
    type: 'combo',
    value: 'option_a',
    y: 0,
    options: {
      values: ['option_a', 'option_b', 'option_c']
    },
    ...overrides
  }
}

function renderWidgetItem(
  widget: IBaseWidget,
  node: LGraphNode = createMockNode(),
  onUpdateWidgetValue?: (value: WidgetValue) => void
) {
  return render(WidgetItem, {
    props: {
      widget,
      node,
      ...(onUpdateWidgetValue
        ? { 'onUpdate:widgetValue': onUpdateWidgetValue }
        : {})
    },
    global: {
      plugins: [i18n],
      stubs: {
        EditableText: { template: '<span />' },
        WidgetActions: { template: '<span />' }
      }
    }
  })
}

function getStubWidget(container: Element) {
  // oxlint-disable-next-line testing-library/no-node-access
  const el = container.querySelector('.stub-widget')
  if (!el) throw new Error('stub-widget not found')
  return {
    options: JSON.parse(el.getAttribute('data-widget-options') ?? 'null'),
    type: el.getAttribute('data-widget-type'),
    name: el.getAttribute('data-widget-name'),
    value: el.getAttribute('data-widget-value')
  }
}

describe('WidgetItem', () => {
  describe('button actions', () => {
    beforeEach(() => {
      vi.mocked(getComponent).mockReturnValue(WidgetButton)
    })

    it.for(['button', 'BUTTON'])(
      'invokes a %s callback with the original widget and node context',
      async (type) => {
        const user = userEvent.setup()
        const callback = vi.fn(function (this: IBaseWidget) {
          this.label = 'Restored'
        })
        const widget = createMockWidget({
          type,
          name: 'Restore selected',
          value: undefined,
          options: {},
          callback
        })
        const node = createMockNode()
        renderWidgetItem(widget, node)

        await user.click(screen.getByRole('button', { name: widget.name }))

        expect(callback).toHaveBeenCalledExactlyOnceWith(
          undefined,
          useCanvasStore().canvas,
          node
        )
        expect(widget.label).toBe('Restored')
      }
    )

    it('does not invoke a disabled button callback', async () => {
      const user = userEvent.setup()
      const callback = vi.fn()
      const widget = createMockWidget({
        type: 'button',
        name: 'Restore selected',
        value: undefined,
        options: {},
        disabled: true,
        callback
      })
      renderWidgetItem(widget)

      const button = screen.getByRole('button', { name: widget.name })
      expect(button).toBeDisabled()
      await user.click(button)

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('widget state rendering', () => {
    it('passes options from a regular widget to the widget component', () => {
      const widget = createMockWidget({
        options: { values: ['a', 'b', 'c'] }
      })
      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.options).toEqual({
        values: ['a', 'b', 'c']
      })
    })

    it('passes options from widget state to the widget component', () => {
      const expectedOptions = {
        values: ['model_a.safetensors', 'model_b.safetensors']
      }
      const id = widgetId('test-graph-id', toNodeId(1), 'ckpt_name')
      const widget = createMockWidget({ widgetId: id, name: 'ckpt_name' })
      useWidgetValueStore().registerWidget(id, {
        type: 'combo',
        value: 'model_a.safetensors',
        options: expectedOptions
      })

      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.options).toEqual(expectedOptions)
    })

    it('passes type from widget state to the widget component', () => {
      const id = widgetId('test-graph-id', toNodeId(1), 'ckpt_name')
      const widget = createMockWidget({ widgetId: id, type: 'string' })
      useWidgetValueStore().registerWidget(id, {
        type: 'combo',
        value: 'model_a.safetensors',
        options: { values: ['model_a.safetensors'] }
      })

      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.type).toBe('combo')
    })

    it('passes name from widget state to the widget component', () => {
      const id = widgetId('test-graph-id', toNodeId(1), 'ckpt_name')
      const widget = createMockWidget({ widgetId: id, name: 'source_name' })
      useWidgetValueStore().registerWidget(id, {
        type: 'combo',
        value: 'model_a.safetensors',
        options: { values: ['model_a.safetensors'] }
      })

      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.name).toBe('ckpt_name')
    })

    it('passes value from widget state to the widget component', () => {
      const id = widgetId('test-graph-id', toNodeId(1), 'ckpt_name')
      const widget = createMockWidget({ widgetId: id, value: 'source value' })
      useWidgetValueStore().registerWidget(id, {
        type: 'combo',
        value: 'model_a.safetensors',
        options: { values: ['model_a.safetensors'] }
      })

      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.value).toBe('model_a.safetensors')
    })

    it('passes null from widget state to the widget component', () => {
      const id = widgetId('test-graph-id', toNodeId(1), 'ckpt_name')
      const widget = createMockWidget({ widgetId: id, value: 'source value' })
      useWidgetValueStore().registerWidget(id, {
        type: 'combo',
        value: null,
        options: {}
      })

      const { container } = renderWidgetItem(widget)
      const stub = getStubWidget(container)

      expect(stub.value).toBe('null')
    })

    it('updates disabled options when the widget input is linked', async () => {
      const inputs: INodeInputSlot[] = [
        {
          name: 'seed',
          type: 'INT',
          link: null,
          boundingRect: [0, 0, 0, 0],
          widget: { name: 'seed' }
        }
      ]
      const node = createMockNode(
        fromAny<Partial<LGraphNode>, unknown>({ inputs })
      )
      const widget = createMockWidget({ name: 'seed', options: {} })

      const { container } = renderWidgetItem(widget, node)
      expect(getStubWidget(container).options.disabled).toBeUndefined()

      const graphScope = graphScopeOf(node.graph!)
      useLinkStore().registerLink(graphScope, {
        id: toLinkId(1),
        graphId: graphScope.owningGraphId,
        originNodeId: toNodeId(2),
        originSlot: 0,
        targetNodeId: node.id,
        targetSlot: 0,
        type: 'INT'
      })
      await nextTick()

      expect(getStubWidget(container).options.disabled).toBe(true)
    })
  })

  describe('enhance prompt', () => {
    function enhanceButton() {
      return screen.queryByRole('button', { name: 'Enhance prompt' })
    }

    it.for([
      {
        type: 'customtext',
        nodeType: 'CLIPTextEncode',
        agent: true,
        visible: true
      },
      {
        type: 'multiline',
        nodeType: 'CLIPTextEncode',
        agent: true,
        visible: true
      },
      {
        type: 'textarea',
        nodeType: 'CLIPTextEncode',
        agent: true,
        visible: true
      },
      {
        type: 'combo',
        nodeType: 'CLIPTextEncode',
        agent: true,
        visible: false
      },
      {
        type: 'customtext',
        nodeType: 'KSampler',
        agent: true,
        visible: false
      },
      {
        type: 'customtext',
        nodeType: 'CLIPTextEncode',
        agent: false,
        visible: false
      }
    ])(
      '$type on $nodeType with agent=$agent → visible=$visible',
      ({ type, nodeType, agent, visible }) => {
        useAgentPanelStore().enabled = agent
        renderWidgetItem(
          createMockWidget({ type, name: 'prompt', value: 'a cat' }),
          createMockNode({ type: nodeType })
        )

        expect(Boolean(enhanceButton())).toBe(visible)
      }
    )

    it('shows the button on partner API nodes', () => {
      useAgentPanelStore().enabled = true
      vi.spyOn(useNodeDefStore(), 'getNodeDefByName').mockReturnValue(
        fromPartial({ api_node: true })
      )
      renderWidgetItem(
        createMockWidget({
          type: 'customtext',
          name: 'prompt',
          value: 'a cat'
        }),
        createMockNode({ type: 'ByteDanceSeedance' })
      )

      expect(enhanceButton()).toBeInTheDocument()
    })

    it('hides the button when the prompt field is read-only', () => {
      useAgentPanelStore().enabled = true
      renderWidgetItem(
        createMockWidget({
          type: 'customtext',
          name: 'prompt',
          value: 'a cat',
          options: { read_only: true }
        }),
        createMockNode({ type: 'CLIPTextEncode' })
      )

      expect(enhanceButton()).not.toBeInTheDocument()
    })

    it('replaces the prompt in place when enhance succeeds', async () => {
      useAgentPanelStore().enabled = true
      const widget = createMockWidget({
        type: 'customtext',
        name: 'prompt',
        value: 'a cat'
      })
      const onUpdate = vi.fn((value: WidgetValue) => {
        widget.value = value
      })
      renderWidgetItem(
        widget,
        createMockNode({ type: 'CLIPTextEncode' }),
        onUpdate
      )

      await userEvent.click(
        screen.getByRole('button', { name: 'Enhance prompt' })
      )

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith('a cat rewritten')
      })
      expect(widget.value).toBe('a cat rewritten')
    })

    it('leaves the original prompt unchanged when enhance fails', async () => {
      useAgentPanelStore().enabled = true
      enhancePromptRequest.mockResolvedValueOnce({
        ok: false,
        reason: 'failed'
      })
      const widget = createMockWidget({
        type: 'customtext',
        name: 'prompt',
        value: 'keep this wording'
      })
      const onUpdate = vi.fn((value: WidgetValue) => {
        widget.value = value
      })
      renderWidgetItem(
        widget,
        createMockNode({ type: 'CLIPTextEncode' }),
        onUpdate
      )

      await userEvent.click(
        screen.getByRole('button', { name: 'Enhance prompt' })
      )
      await nextTick()

      expect(widget.value).toBe('keep this wording')
      expect(onUpdate).not.toHaveBeenCalled()
    })

    it('locks the prompt field while the enhance request is in flight', async () => {
      useAgentPanelStore().enabled = true
      let resolveRequest: (result: { ok: true; prompt: string }) => void = () =>
        undefined
      enhancePromptRequest.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRequest = resolve
          })
      )
      const widget = createMockWidget({
        type: 'customtext',
        name: 'prompt',
        value: 'original prompt'
      })
      renderWidgetItem(widget, createMockNode({ type: 'CLIPTextEncode' }))

      const pending = userEvent.click(
        screen.getByRole('button', { name: 'Enhance prompt' })
      )
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Enhancing prompt' })
        ).toBeDisabled()
      })

      resolveRequest({ ok: true, prompt: 'rewritten prompt' })
      await pending
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Enhance prompt' })
        ).toBeEnabled()
      })
    })
  })
})
