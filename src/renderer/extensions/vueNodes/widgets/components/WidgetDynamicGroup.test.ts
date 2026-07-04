import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { DynamicGroupNode } from '@/core/graph/widgets/dynamicWidgets'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { HasInitialMinSize } from '@/services/litegraphService'
import { toNodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetDynamicGroup from './WidgetDynamicGroup.vue'

const appMocks = vi.hoisted(() => ({
  graph: null as LGraph | null
}))

const FieldStub = vi.hoisted(() => ({
  name: 'FieldStub',
  props: {
    modelValue: { type: [String, Number], default: '' },
    widget: { type: Object, required: true }
  },
  emits: ['update:modelValue'],
  template:
    '<input data-testid="field" :aria-label="widget.name" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
}))

vi.mock('@/scripts/app', () => ({
  app: {
    get graph() {
      return appMocks.graph
    }
  }
}))

vi.mock(
  '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry',
  () => ({
    getComponent: () => FieldStub
  })
)

const ButtonStub = {
  name: 'Button',
  props: { disabled: Boolean },
  template: '<button type="button" :disabled="disabled"><slot /></button>'
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      dynamicGroup: {
        addGroup: 'Add {group_name}',
        removeGroup: 'Remove {group_name}',
        group: '{group_name} #{index}',
        defaultGroupName: 'Group'
      }
    }
  }
})

function fieldWidget(name: string, value = ''): IBaseWidget {
  return {
    name,
    type: 'string',
    value,
    options: {},
    y: 0
  }
}

function createDynamicGroupNode({
  min = 1,
  max = 3,
  groupName = 'Lora',
  fieldsPerRow = ['text'],
  rows = [0]
}: {
  min?: number
  max?: number
  groupName?: string
  fieldsPerRow?: string[]
  rows?: number[]
} = {}): DynamicGroupNode {
  const node = new LGraphNode('test') as DynamicGroupNode &
    Partial<HasInitialMinSize>
  node._initialMinSize = { width: 1, height: 1 }
  node.widgets = [
    {
      name: 'loras',
      type: 'dynamic_group',
      value: rows.length,
      options: { min, max },
      y: 0
    },
    ...rows.flatMap((row) =>
      fieldsPerRow.map((field) => fieldWidget(`loras.${row}.${field}`))
    )
  ]

  const state = {
    min,
    max,
    groupName,
    inputSpecs: [],
    addRow: vi.fn(),
    removeRow: vi.fn()
  }
  node.comfyDynamic = { dynamicGroup: { loras: state } }

  const graph = new LGraph()
  graph.add(node)
  appMocks.graph = graph

  return node
}

function mountWidgetDynamicGroup(node: DynamicGroupNode) {
  const state = node.comfyDynamic.dynamicGroup.loras
  const widget: SimplifiedWidget<number> = {
    name: 'loras',
    type: 'dynamic_group',
    value: node.widgets!.filter((w) => w.name.startsWith('loras.')).length,
    options: { min: state.min, max: state.max }
  }

  return render(WidgetDynamicGroup, {
    global: {
      plugins: [i18n],
      stubs: { Button: ButtonStub }
    },
    props: {
      widget,
      nodeId: toNodeId(String(node.id)),
      nodeType: 'testnode'
    }
  })
}

describe('WidgetDynamicGroup', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia())
    appMocks.graph = null
  })

  it('renders one row per field widget with the configured group name', () => {
    mountWidgetDynamicGroup(createDynamicGroupNode({ min: 2, rows: [0, 1] }))

    expect(screen.getByText('Lora #1')).toBeInTheDocument()
    expect(screen.getByText('Lora #2')).toBeInTheDocument()
    expect(screen.getAllByTestId('field')).toHaveLength(2)
  })

  it('renders multiple fields per row', () => {
    mountWidgetDynamicGroup(
      createDynamicGroupNode({
        rows: [0, 1],
        fieldsPerRow: ['text', 'strength']
      })
    )

    expect(screen.getAllByTestId('field')).toHaveLength(4)
    expect(
      screen.getByRole('textbox', { name: 'loras.0.text' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('textbox', { name: 'loras.1.strength' })
    ).toBeInTheDocument()
  })

  it('calls addRow when the add button is clicked', async () => {
    const node = createDynamicGroupNode({ min: 1, max: 3 })
    const user = userEvent.setup()

    mountWidgetDynamicGroup(node)
    await user.click(screen.getByRole('button', { name: 'Add Lora' }))

    expect(node.comfyDynamic.dynamicGroup.loras.addRow).toHaveBeenCalledTimes(1)
  })

  it('calls removeRow with the correct row index', async () => {
    const node = createDynamicGroupNode({ min: 0, max: 3, rows: [0, 1, 2] })
    const user = userEvent.setup()

    mountWidgetDynamicGroup(node)
    const removeButtons = screen.getAllByRole('button', { name: 'Remove Lora' })
    await user.click(removeButtons[2]!)

    expect(node.comfyDynamic.dynamicGroup.loras.removeRow).toHaveBeenCalledWith(
      2
    )
  })

  it('only shows remove buttons for rows above the minimum', () => {
    mountWidgetDynamicGroup(createDynamicGroupNode({ min: 2, rows: [0, 1, 2] }))

    const removeButtons = screen.getAllByRole('button', { name: 'Remove Lora' })
    expect(removeButtons).toHaveLength(1)
  })

  it('hides all remove buttons when row count equals min', () => {
    mountWidgetDynamicGroup(createDynamicGroupNode({ min: 1, rows: [0] }))

    expect(
      screen.queryByRole('button', { name: 'Remove Lora' })
    ).not.toBeInTheDocument()
  })

  it('disables the add button when the group is at max capacity', () => {
    mountWidgetDynamicGroup(
      createDynamicGroupNode({ min: 0, max: 2, rows: [0, 1] })
    )

    expect(screen.getByRole('button', { name: 'Add Lora' })).toBeDisabled()
  })

  it('enables the add button when below max capacity', () => {
    mountWidgetDynamicGroup(
      createDynamicGroupNode({ min: 0, max: 3, rows: [0, 1] })
    )

    expect(screen.getByRole('button', { name: 'Add Lora' })).not.toBeDisabled()
  })

  it('updates a field widget value when edited', async () => {
    const node = createDynamicGroupNode({ rows: [0] })
    const rowWidget = node.widgets!.find((w) => w.name === 'loras.0.text')!
    const user = userEvent.setup()

    mountWidgetDynamicGroup(node)

    const field = screen.getByTestId('field')
    await user.clear(field)
    await user.type(field, 'my-lora')

    expect(rowWidget.value).toBe('my-lora')
  })

  it('uses the default group name when groupName is not configured', () => {
    const node = createDynamicGroupNode({ rows: [0] })
    node.comfyDynamic.dynamicGroup.loras.groupName = undefined

    mountWidgetDynamicGroup(node)

    expect(screen.getByText('Group #1')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add Group' })
    ).toBeInTheDocument()
  })

  it('renders nothing when the node is not on the graph', () => {
    const node = createDynamicGroupNode({ rows: [0, 1] })
    appMocks.graph = null

    mountWidgetDynamicGroup(node)

    expect(screen.queryAllByTestId('field')).toHaveLength(0)
    expect(
      screen.getByRole('button', { name: 'Add Group' })
    ).toBeInTheDocument()
  })
})
