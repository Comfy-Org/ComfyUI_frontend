import type { Decorator, Meta, StoryObj } from '@storybook/vue3-vite'
import { onBeforeUnmount } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAssetsStore } from '@/stores/assetsStore'

import { useAgentOutputsTrayStore } from '@/workbench/extensions/agent/stores/agent/agentOutputsTrayStore'
import '@/workbench/extensions/agent/agentPanel.css'

import OutputsTray from './OutputsTray.vue'

const SAMPLE_IMAGE = '/assets/images/default-template.png'

function output(name: string, overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: `id-${name}`,
    name,
    tags: ['output'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  }
}

function image(name: string, overrides: Partial<AssetItem> = {}): AssetItem {
  return output(name, { thumbnail_url: SAMPLE_IMAGE, ...overrides })
}

const outputs: AssetItem[] = [
  image('ComfyUI_00012_.png', {
    id: 'job-12',
    user_metadata: {
      jobId: 'job-12',
      nodeId: '9',
      subfolder: '',
      outputCount: 4
    }
  }),
  image('ComfyUI_00011_.png'),
  output('ComfyUI_00003_.flac'),
  image('ComfyUI_00010_.png'),
  output('ComfyUI_00002_.glb'),
  image('ComfyUI_00009_.png'),
  output('latent_00001_.safetensors'),
  image('ComfyUI_00008_.png'),
  image('ComfyUI_00007_.png')
]

type OutputList = ReturnType<typeof useAssetsStore>['outputAssets']

function withOutputs(
  list: Partial<OutputList>,
  selected: string[] = []
): Decorator {
  return () => ({
    setup() {
      const assetsStore = useAssetsStore()
      const realOutputs = assetsStore.outputAssets
      assetsStore.outputAssets = {
        items: [],
        hasMore: false,
        isLoading: false,
        loadMore: async () => false,
        loadNew: async () => {},
        invalidate: async () => {},
        ...list
      }
      const tray = useAgentOutputsTrayStore()
      tray.dispatch({ type: 'opened' })
      for (const key of selected) tray.dispatch({ type: 'tileToggled', key })
      onBeforeUnmount(() => {
        tray.dispatch({ type: 'closed' })
        assetsStore.outputAssets = realOutputs
      })
    },
    template: '<story />'
  })
}

const meta: Meta<typeof OutputsTray> = {
  title: 'Agent/Outputs/OutputsTray',
  component: OutputsTray,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template:
        '<div class="agent-scope flex h-150 w-100 flex-col justify-end bg-secondary p-4"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  decorators: [withOutputs({ isLoading: true })]
}

export const Empty: Story = {
  decorators: [withOutputs({})]
}

export const Populated: Story = {
  decorators: [
    withOutputs({ items: outputs, hasMore: true }, [
      'id-ComfyUI_00011_.png',
      'id-latent_00001_.safetensors'
    ])
  ]
}
