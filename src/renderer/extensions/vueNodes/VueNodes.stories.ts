import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { useArgs } from 'storybook/preview-api'
import { fn } from 'storybook/test'
import { computed, onScopeDispose, ref } from 'vue'

import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import WidgetColorPicker from '@/renderer/extensions/vueNodes/widgets/components/WidgetColorPicker.vue'
import WidgetInputNumberGradientSlider from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumberGradientSlider.vue'
import WidgetInputNumberSlider from '@/renderer/extensions/vueNodes/widgets/components/WidgetInputNumberSlider.vue'
import WidgetToggleSwitch from '@/renderer/extensions/vueNodes/widgets/components/WidgetToggleSwitch.vue'
import { getComponent } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import {
  ModelNodeProvider,
  useModelToNodeStore
} from '@/stores/modelToNodeStore'
import { CONTROL_OPTIONS, isControlOption } from '@/types/simplifiedWidget'
import type { ControlOptions, SimplifiedWidget } from '@/types/simplifiedWidget'
import { zeroUuid } from '@/utils/uuid'

import NodeHeader from './components/NodeHeader.vue'
import SlotConnectionDot from './components/SlotConnectionDot.vue'
import WidgetGrid from './components/WidgetGrid.vue'

const modelOptions = [
  'checkpoints/sdxl/base/model.safetensors',
  'checkpoints/sdxl/finetuned/model.safetensors',
  'checkpoints/portraits/portrait-v2.safetensors'
]
const samplerOptions = ['euler', 'euler_ancestral', 'dpmpp_2m', 'heun']

type StoryArgs = {
  title: string
  width: number
  collapsed: boolean
  seed: number
  seedMode: ControlOptions
  steps: number
  cfg: number
  sampler: string
  model: string
  text: string
  prompt: string
  enabled: boolean
  disabled: boolean
  labels: Record<string, string>
  onWidgetChange: ReturnType<typeof fn>
}

const meta: Meta<StoryArgs> = {
  title: 'Components/Node/Vue Nodes',
  component: WidgetGrid,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    controls: {
      exclude: [
        'processedWidgets',
        'nodeType',
        'canSelectInputs',
        'nodeId',
        'nodeTitle',
        'syncLayout'
      ]
    },
    docs: {
      description: {
        component:
          'Interactive Nodes 2.0 header and widget grid without a canvas or backend. Controls and widget edits stay in sync. Slot dots are display-only; model summaries retain their full path values.'
      }
    }
  },
  args: {
    title: 'Vue Node',
    width: 350,
    collapsed: false,
    seed: 156680208700286,
    seedMode: 'randomize',
    steps: 20,
    cfg: 8,
    sampler: 'euler',
    model: modelOptions[0],
    text: 'output/ComfyUI',
    prompt: 'A glass bottle containing a purple galaxy, detailed photography.',
    enabled: true,
    disabled: false,
    labels: {},
    onWidgetChange: fn()
  },
  argTypes: {
    title: { control: 'text' },
    width: { control: { type: 'range', min: 220, max: 640, step: 10 } },
    collapsed: { control: 'boolean' },
    seed: { control: { type: 'number', min: 0, max: Number.MAX_SAFE_INTEGER } },
    seedMode: { control: 'select', options: [...CONTROL_OPTIONS] },
    steps: { control: { type: 'number', min: 1, max: 100 } },
    cfg: { control: { type: 'number', min: 0, max: 20, step: 0.5 } },
    sampler: { control: 'select', options: samplerOptions },
    model: { control: 'select', options: modelOptions },
    text: { control: 'text' },
    prompt: { control: 'text' },
    enabled: { control: 'boolean' },
    disabled: { control: 'boolean' },
    labels: {
      control: 'object',
      description:
        'Display-label overrides keyed by widget name, such as seed, steps, ckpt_name or prompt.'
    },
    onWidgetChange: { control: false, table: { disable: true } }
  },
  render: (args) => {
    const [, updateArgs] = useArgs<StoryArgs>()
    return {
      components: { NodeHeader, SlotConnectionDot, WidgetGrid },
      setup() {
        const store = useModelToNodeStore()
        const previousMappings = store.modelToNodeMap
        store.modelToNodeMap = {
          checkpoints: [
            new ModelNodeProvider(
              new ComfyNodeDefImpl({
                name: 'CheckpointLoaderSimple',
                display_name: 'Load Checkpoint',
                category: 'loaders',
                python_module: 'nodes',
                description: '',
                output_node: false,
                input: { required: { ckpt_name: [modelOptions] } },
                output: ['MODEL', 'CLIP', 'VAE']
              }),
              'ckpt_name'
            )
          ]
        }
        onScopeDispose(() => {
          store.modelToNodeMap = previousMappings
        })

        const nodeData = computed<NodeState>(() => ({
          id: toNodeId('storybook-vue-node'),
          graphId: zeroUuid,
          type: 'CheckpointLoaderSimple',
          title: args.title,
          mode: 0,
          flags: {},
          properties: {},
          inputs: [
            {
              name: 'model',
              type: 'MODEL',
              boundingRect: [0, 0, 0, 0],
              link: null
            },
            {
              name: 'positive',
              type: 'CONDITIONING',
              boundingRect: [0, 0, 0, 0],
              link: null
            },
            {
              name: 'negative',
              type: 'CONDITIONING',
              boundingRect: [0, 0, 0, 0],
              link: null
            },
            {
              name: 'latent_image',
              type: 'LATENT',
              boundingRect: [0, 0, 0, 0],
              link: null
            }
          ],
          outputs: [
            {
              name: 'LATENT',
              type: 'LATENT',
              boundingRect: [0, 0, 0, 0],
              links: []
            }
          ]
        }))

        const widgets = computed<WidgetGridItem[]>(() => {
          const definitions: (SimplifiedWidget & { arg: keyof StoryArgs })[] = [
            {
              arg: 'seed',
              name: 'seed',
              type: 'INT',
              value: args.seed,
              options: {
                min: 0,
                max: Number.MAX_SAFE_INTEGER,
                step: 10,
                precision: 0
              },
              controlWidget: {
                value: args.seedMode,
                update(value) {
                  if (isControlOption(value)) updateArgs({ seedMode: value })
                }
              }
            },
            {
              arg: 'steps',
              name: 'steps',
              type: 'INT',
              value: args.steps,
              options: { min: 1, max: 100, step: 10, precision: 0 }
            },
            {
              arg: 'cfg',
              name: 'cfg',
              type: 'FLOAT',
              value: args.cfg,
              options: { min: 0, max: 20, step: 5, precision: 1 }
            },
            {
              arg: 'sampler',
              name: 'sampler_name',
              type: 'COMBO',
              value: args.sampler,
              options: { values: samplerOptions }
            },
            {
              arg: 'model',
              name: 'ckpt_name',
              type: 'COMBO',
              value: args.model,
              options: { values: modelOptions }
            },
            {
              arg: 'text',
              name: 'filename_prefix',
              type: 'STRING',
              value: args.text
            },
            {
              arg: 'prompt',
              name: 'prompt',
              type: 'customtext',
              value: args.prompt
            },
            {
              arg: 'enabled',
              name: 'enabled',
              type: 'BOOLEAN',
              value: args.enabled
            }
          ]
          return definitions.map(({ arg, ...widget }) => ({
            renderKey:
              widget.name === 'seed'
                ? `${widget.name}:${args.seedMode}`
                : widget.name,
            visible: true,
            simplified: {
              ...widget,
              label: args.labels[widget.name] ?? widget.name,
              options: { ...widget.options, disabled: args.disabled }
            },
            vueComponent: getComponent(widget.type) ?? WidgetLegacy,
            updateHandler(value) {
              args.onWidgetChange(widget.name, value)
              updateArgs({ [arg]: value })
            }
          }))
        })

        return { args, nodeData, widgets, updateArgs }
      },
      template: `
        <div
          class="lg-node flex flex-col rounded-2xl border border-node-border bg-node pb-3 text-xs text-node-foreground"
          :style="{ width: args.width + 'px' }"
          data-testid="vue-node-story"
        >
          <div class="rounded-t-2xl bg-node-header">
            <NodeHeader
              :node-data="nodeData"
              :collapsed="args.collapsed"
              @collapse="updateArgs({ collapsed: !args.collapsed })"
              @update:title="updateArgs({ title: $event })"
            />
          </div>
          <div v-if="!args.collapsed" class="flex flex-col gap-2">
            <div class="flex justify-between">
              <div class="flex min-w-0 flex-col">
                <div v-for="slot in nodeData.inputs" :key="slot.name" class="flex h-5 items-center">
                  <SlotConnectionDot :slot-data="slot" class="w-3 -translate-x-1/2" />
                  <span class="truncate">{{ slot.name }}</span>
                </div>
              </div>
              <div class="flex min-w-0 flex-col">
                <div v-for="slot in nodeData.outputs" :key="slot.name" class="flex h-5 items-center">
                  <span class="truncate">{{ slot.name }}</span>
                  <SlotConnectionDot :slot-data="slot" class="w-3 translate-x-1/2" />
                </div>
              </div>
            </div>
            <WidgetGrid
              :processed-widgets="widgets"
              :node-type="nodeData.type"
              :node-id="nodeData.id"
              :sync-layout="false"
            />
          </div>
        </div>
      `
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const NarrowLongLabels: Story = {
  args: {
    width: 250,
    title: 'Long labels and model paths',
    labels: {
      seed: 'Random noise generation seed',
      steps: 'Number of sampling steps',
      ckpt_name: 'Checkpoint model filename',
      prompt: 'Positive conditioning prompt'
    },
    model: modelOptions[1],
    prompt: ''
  }
}

export const OtherControlTypes: Story = {
  render: (args) => ({
    components: {
      WidgetColorPicker,
      WidgetInputNumberGradientSlider,
      WidgetInputNumberSlider,
      WidgetToggleSwitch
    },
    setup() {
      const slider = ref(37)
      const gradient = ref(63)
      const color = ref('#E06CBD')
      const enabled = ref(true)
      const labelled = ref(false)
      const widgets = computed(() => ({
        slider: {
          name: 'slider',
          type: 'slider',
          value: 37,
          options: { min: 0, max: 100, step2: 1, disabled: args.disabled }
        },
        gradient: {
          name: 'gradient',
          type: 'gradientslider',
          value: 63,
          options: { min: 0, max: 100, step2: 1, disabled: args.disabled }
        },
        color: {
          name: 'color',
          type: 'STRING',
          value: '#E06CBD',
          options: { disabled: args.disabled }
        },
        enabled: {
          name: 'enabled',
          type: 'BOOLEAN',
          value: true,
          options: { disabled: args.disabled }
        },
        labelled: {
          name: 'labelled_boolean',
          type: 'BOOLEAN',
          value: false,
          options: { on: 'On', off: 'Off', disabled: args.disabled }
        }
      }))
      return { args, widgets, slider, gradient, color, enabled, labelled }
    },
    template: `
      <div class="lg-node flex flex-col gap-3 rounded-2xl bg-node p-3 text-xs text-node-foreground" :style="{ width: args.width + 'px' }">
        <WidgetInputNumberSlider v-model="slider" :widget="widgets.slider" />
        <WidgetInputNumberGradientSlider v-model="gradient" :widget="widgets.gradient" />
        <WidgetColorPicker v-model="color" :widget="widgets.color" />
        <WidgetToggleSwitch v-model="enabled" :widget="widgets.enabled" />
        <WidgetToggleSwitch v-model="labelled" :widget="widgets.labelled" />
      </div>
    `
  })
}
