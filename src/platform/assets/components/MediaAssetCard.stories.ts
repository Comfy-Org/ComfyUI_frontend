import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ResultGallery from '@/components/sidebar/tabs/queue/ResultGallery.vue'

import { useMediaAssetGalleryStore } from '../composables/useMediaAssetGalleryStore'
import type { AssetMeta } from '../schemas/mediaAssetSchema'
import MediaAssetCard from './MediaAssetCard.vue'

const meta: Meta<typeof MediaAssetCard> = {
  title: 'Platform/Assets/MediaAssetCard',
  component: MediaAssetCard,
  decorators: [
    () => ({
      components: { ResultGallery },
      setup() {
        const galleryStore = useMediaAssetGalleryStore()
        return { galleryStore }
      },
      template: `
        <div>
          <story />
          <ResultGallery 
            v-model:active-index="galleryStore.activeIndex"
            :all-gallery-items="galleryStore.items"
          />
        </div>
      `
    })
  ],
  argTypes: {
    context: {
      control: 'select',
      options: ['input', 'output']
    },
    loading: {
      control: 'boolean'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

// Public sample media URLs
const SAMPLE_MEDIA = {
  image1: 'https://i.imgur.com/OB0y6MR.jpg',
  image2: 'https://i.imgur.com/CzXTtJV.jpg',
  image3: 'https://farm9.staticflickr.com/8505/8441256181_4e98d8bff5_z_d.jpg',
  video:
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  videoThumbnail:
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
  audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
}

const sampleAsset: AssetMeta = {
  id: 'asset-1',
  name: 'sample-image.png',
  kind: 'image',
  duration: 3345,
  size: 2048576,
  created_at: Date.now().toString(),
  src: SAMPLE_MEDIA.image1,
  dimensions: {
    width: 1920,
    height: 1080
  },
  tags: []
}

export const ImageAsset: Story = {
  decorators: [
    () => ({
      template: '<div style="max-width: 280px;"><story /></div>'
    })
  ],
  args: {
    context: { type: 'output', outputCount: 3 },
    asset: sampleAsset,
    loading: false
  }
}

export const VideoAsset: Story = {
  decorators: [
    () => ({
      template: '<div style="max-width: 280px;"><story /></div>'
    })
  ],
  args: {
    context: { type: 'input' },
    asset: {
      ...sampleAsset,
      id: 'asset-2',
      name: 'Big_Buck_Bunny.mp4',
      kind: 'video',
      size: 10485760,
      duration: 13425,
      preview_url: SAMPLE_MEDIA.videoThumbnail, // Poster image
      src: SAMPLE_MEDIA.video, // Actual video file
      dimensions: {
        width: 1280,
        height: 720
      }
    }
  }
}

export const Model3DAsset: Story = {
  decorators: [
    () => ({
      template: '<div style="max-width: 280px;"><story /></div>'
    })
  ],
  args: {
    context: { type: 'input' },
    asset: {
      ...sampleAsset,
      id: 'asset-3',
      name: 'Asset-3d-model.glb',
      kind: '3D',
      size: 7340032,
      src: '',
      dimensions: undefined,
      duration: 18023
    }
  }
}

export const AudioAsset: Story = {
  decorators: [
    () => ({
      template: '<div style="max-width: 280px;"><story /></div>'
    })
  ],
  args: {
    context: { type: 'input' },
    asset: {
      ...sampleAsset,
      id: 'asset-3',
      name: 'SoundHelix-Song.mp3',
      kind: 'audio',
      size: 5242880,
      src: SAMPLE_MEDIA.audio,
      dimensions: undefined,
      duration: 23180
    }
  }
}

export const LoadingState: Story = {
  decorators: [
    () => ({
      template: '<div style="max-width: 280px;"><story /></div>'
    })
  ],
  args: {
    context: { type: 'input' },
    asset: sampleAsset,
    loading: true
  }
}

export const LongFileName: Story = {
  decorators: [
    () => ({
      template: '<div style="max-width: 280px;"><story /></div>'
    })
  ],
  args: {
    context: { type: 'input' },
    asset: {
      ...sampleAsset,
      name: 'very-long-file-name-that-should-be-truncated-in-the-ui-to-prevent-overflow.png'
    }
  }
}

export const SelectedState: Story = {
  decorators: [
    () => ({
      template: '<div style="max-width: 280px;"><story /></div>'
    })
  ],
  args: {
    context: { type: 'output', outputCount: 2 },
    asset: sampleAsset,
    selected: true
  }
}

export const WebMVideo: Story = {
  decorators: [
    () => ({
      template: '<div style="max-width: 280px;"><story /></div>'
    })
  ],
  args: {
    context: { type: 'input' },
    asset: {
      id: 'asset-webm',
      name: 'animated-clip.webm',
      kind: 'video',
      size: 3145728,
      created_at: Date.now().toString(),
      preview_url: SAMPLE_MEDIA.image1, // Poster image
      src: 'https://www.w3schools.com/html/movie.mp4', // Actual video
      duration: 620,
      dimensions: {
        width: 640,
        height: 360
      },
      tags: []
    }
  }
}

export const GifAnimation: Story = {
  decorators: [
    () => ({
      template: '<div style="max-width: 280px;"><story /></div>'
    })
  ],
  args: {
    context: { type: 'input' },
    asset: {
      id: 'asset-gif',
      name: 'animation.gif',
      kind: 'image',
      size: 1572864,
      duration: 1345,
      created_at: Date.now().toString(),
      src: 'https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/giphy.gif',
      dimensions: {
        width: 480,
        height: 270
      },
      tags: []
    }
  }
}

export const GridLayout: Story = {
  render: () => ({
    components: { MediaAssetCard },
    setup() {
      const assets: AssetMeta[] = [
        {
          id: 'grid-1',
          name: 'image-file.jpg',
          kind: 'image',
          size: 2097152,
          duration: 4500,
          created_at: Date.now().toString(),
          src: SAMPLE_MEDIA.image1,
          dimensions: { width: 1920, height: 1080 },
          tags: []
        },
        {
          id: 'grid-2',
          name: 'image-file.jpg',
          kind: 'image',
          size: 2097152,
          duration: 4500,
          created_at: Date.now().toString(),
          src: SAMPLE_MEDIA.image2,
          dimensions: { width: 1920, height: 1080 },
          tags: []
        },
        {
          id: 'grid-3',
          name: 'video-file.mp4',
          kind: 'video',
          size: 10485760,
          duration: 13425,
          created_at: Date.now().toString(),
          preview_url: SAMPLE_MEDIA.videoThumbnail, // Poster image
          src: SAMPLE_MEDIA.video, // Actual video
          dimensions: { width: 1280, height: 720 },
          tags: []
        },
        {
          id: 'grid-4',
          name: 'audio-file.mp3',
          kind: 'audio',
          size: 5242880,
          duration: 180,
          created_at: Date.now().toString(),
          src: SAMPLE_MEDIA.audio,
          tags: []
        },
        {
          id: 'grid-5',
          name: 'animation.gif',
          kind: 'image',
          size: 3145728,
          duration: 1345,
          created_at: Date.now().toString(),
          src: 'https://media.giphy.com/media/l0HlNaQ6gWfllcjDO/giphy.gif',
          dimensions: { width: 480, height: 360 },
          tags: []
        },
        {
          id: 'grid-6',
          name: 'Asset-3d-model.glb',
          kind: '3D',
          size: 7340032,
          src: '',
          dimensions: undefined,
          duration: 18023,
          created_at: Date.now().toString(),
          tags: []
        },
        {
          id: 'grid-7',
          name: 'image-file.jpg',
          kind: 'image',
          size: 2097152,
          duration: 4500,
          created_at: Date.now().toString(),
          src: SAMPLE_MEDIA.image3,
          dimensions: { width: 1920, height: 1080 },
          tags: []
        }
      ]
      return { assets }
    },
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; padding: 16px;">
        <MediaAssetCard
          v-for="asset in assets"
          :key="asset.id"
          :context="{ type: Math.random() > 0.5 ? 'input' : 'output', outputCount: Math.floor(Math.random() * 5) }"
          :asset="asset"
        />
      </div>
    `
  })
}
