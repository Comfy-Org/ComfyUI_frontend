import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { useAssetSelection } from '@/platform/assets/composables/useAssetSelection'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'

import AssetsSidebarGridView from './AssetsSidebarGridView.vue'

type StoryArgs = {
  assets: AssetItem[]
}

function baseDecorator() {
  return {
    template: `
      <div class="bg-base-background p-6">
        <story />
      </div>
    `
  }
}

const meta: Meta<StoryArgs> = {
  title: 'Components/Sidebar/AssetsSidebarGridView',
  component: AssetsSidebarGridView,
  parameters: {
    layout: 'centered'
  },
  decorators: [baseDecorator]
}

export default meta
type Story = StoryObj<typeof meta>

const SAMPLE_MEDIA = {
  image1: 'https://i.imgur.com/OB0y6MR.jpg',
  image2: 'https://i.imgur.com/CzXTtJV.jpg',
  image3: 'https://farm9.staticflickr.com/8505/8441256181_4e98d8bff5_z_d.jpg',
  videoThumbnail:
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
  audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
}

const baseTimestamp = '2024-01-15T10:00:00Z'

const sampleAssets: AssetItem[] = [
  {
    id: 'asset-image-1',
    name: 'image-032.png',
    created_at: baseTimestamp,
    preview_url: SAMPLE_MEDIA.image1,
    size: 1887437,
    tags: [],
    user_metadata: { executionTimeInSeconds: 1.84 }
  },
  {
    id: 'asset-image-2',
    name: 'landscape-photo.jpg',
    created_at: baseTimestamp,
    preview_url: SAMPLE_MEDIA.image2,
    size: 2097152,
    tags: [],
    user_metadata: { executionTimeInSeconds: 2.31 }
  },
  {
    id: 'asset-video-1',
    name: 'clip-01.mp4',
    created_at: baseTimestamp,
    preview_url: SAMPLE_MEDIA.videoThumbnail,
    size: 8394820,
    tags: [],
    user_metadata: { duration: 132000 }
  },
  {
    id: 'asset-audio-1',
    name: 'soundtrack-01.mp3',
    created_at: baseTimestamp,
    size: 5242880,
    tags: [],
    user_metadata: { duration: 200000 }
  },
  {
    id: 'asset-3d-1',
    name: 'scene-01.glb',
    created_at: baseTimestamp,
    size: 134217728,
    tags: []
  },
  {
    id: 'asset-text-1',
    name: 'generation-notes.txt',
    created_at: baseTimestamp,
    size: 2048,
    tags: []
  },
  {
    id: 'asset-image-3',
    name: 'nature-shot.jpg',
    created_at: baseTimestamp,
    preview_url: SAMPLE_MEDIA.image3,
    size: 3145728,
    tags: [],
    user_metadata: { executionTimeInSeconds: 3.12 }
  }
]

function renderGridView(args: StoryArgs) {
  return {
    components: { AssetsSidebarGridView },
    setup() {
      const { isSelected, handleAssetClick } = useAssetSelection()

      function onSelectAsset(asset: AssetItem) {
        const index = args.assets.findIndex((a) => a.id === asset.id)
        handleAssetClick(asset, index, args.assets)
      }
      function showOutputCount() {
        return false
      }
      function getOutputCount() {
        return 0
      }

      return {
        args,
        isSelected,
        onSelectAsset,
        showOutputCount,
        getOutputCount
      }
    },
    template: `
      <div class="h-[520px] w-[640px] overflow-hidden rounded-lg border border-panel-border">
        <AssetsSidebarGridView
          :assets="args.assets"
          :is-selected="isSelected"
          :show-output-count="showOutputCount"
          :get-output-count="getOutputCount"
          @select-asset="onSelectAsset"
        />
      </div>
    `
  }
}

export const Default: Story = {
  args: {
    assets: sampleAssets
  },
  render: renderGridView
}

export const SingleAsset: Story = {
  args: {
    assets: [sampleAssets[0]]
  },
  render: renderGridView
}

export const Empty: Story = {
  args: {
    assets: []
  },
  render: renderGridView
}
