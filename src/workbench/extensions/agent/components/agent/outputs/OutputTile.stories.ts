import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import '@/workbench/extensions/agent/agentPanel.css'

import OutputTile from './OutputTile.vue'

const SAMPLE_IMAGE = '/assets/images/default-template.png'
const SAMPLE_VIDEO =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

const image: AssetItem = {
  id: 'asset-image',
  name: 'ComfyUI_00012_.png',
  tags: ['output'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  thumbnail_url: SAMPLE_IMAGE,
  preview_url: SAMPLE_IMAGE
}

const video: AssetItem = {
  ...image,
  id: 'asset-video',
  name: 'ComfyUI_00003_.mp4',
  thumbnail_url: undefined,
  preview_url: SAMPLE_VIDEO
}

const audio: AssetItem = {
  ...image,
  id: 'asset-audio',
  name: 'ComfyUI_00007_.flac',
  thumbnail_url: undefined,
  preview_url: undefined
}

const meta: Meta<typeof OutputTile> = {
  title: 'Agent/Outputs/OutputTile',
  component: OutputTile,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: {
    asset: image,
    kind: 'image',
    name: 'Sunset over the bay.png',
    selected: false,
    inMessage: false
  },
  decorators: [
    () => ({
      template:
        '<ul class="agent-scope m-0 w-36 list-none bg-secondary p-4"><story /></ul>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

export const ImageFile: Story = {}

export const VideoFile: Story = {
  args: { asset: video, kind: 'video', name: 'Camera pan.mp4' }
}

export const AudioFile: Story = {
  args: { asset: audio, kind: 'audio', name: 'Voice over take 3.flac' }
}

export const Selected: Story = {
  args: { selected: true }
}

export const InMessage: Story = {
  args: { inMessage: true }
}

export const Stacked: Story = {
  args: { stackCount: 4 }
}

export const StackedExpanded: Story = {
  args: { stackCount: 4, stackExpanded: true }
}

export const StackedLoading: Story = {
  args: { stackCount: 4, stackLoading: true }
}
