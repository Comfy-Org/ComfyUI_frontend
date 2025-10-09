import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { AssetMeta } from '@/types/media.types'

import QueueAssetCard from './MediaAssetCard.vue'

const meta: Meta<typeof QueueAssetCard> = {
  title: 'AssetLibrary/QueueAssetCard',
  component: QueueAssetCard,
  argTypes: {
    context: {
      control: 'select',
      options: ['input', 'output']
    },
    dense: {
      control: 'boolean'
    },
    loading: {
      control: 'boolean'
    }
  },
  decorators: [
    () => ({
      template: '<div style="max-width: 280px;"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

// Public sample media URLs
const SAMPLE_MEDIA = {
  image: 'https://picsum.photos/400/300',
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
  size: 2048576,
  timestamp: Date.now(),
  thumbnailUrl: SAMPLE_MEDIA.image,
  dimensions: {
    width: 1920,
    height: 1080
  }
}

export const ImageAsset: Story = {
  args: {
    context: 'input',
    asset: sampleAsset,
    loading: false,
    dense: false
  }
}

export const VideoAsset: Story = {
  args: {
    context: 'input',
    asset: {
      ...sampleAsset,
      id: 'asset-2',
      name: 'Big_Buck_Bunny.mp4',
      kind: 'video',
      size: 10485760,
      duration: 125,
      thumbnailUrl: SAMPLE_MEDIA.videoThumbnail, // Poster image
      videoUrl: SAMPLE_MEDIA.video, // Actual video file
      dimensions: {
        width: 1280,
        height: 720
      }
    }
  }
}

export const AudioAsset: Story = {
  args: {
    context: 'input',
    asset: {
      ...sampleAsset,
      id: 'asset-3',
      name: 'SoundHelix-Song.mp3',
      kind: 'audio',
      size: 5242880,
      thumbnailUrl: SAMPLE_MEDIA.audio,
      dimensions: undefined,
      duration: 180
    }
  }
}

export const TextAsset: Story = {
  args: {
    context: 'input',
    asset: {
      ...sampleAsset,
      id: 'asset-4',
      name: 'prompt-text.txt',
      kind: 'text',
      size: 1024,
      thumbnailUrl: undefined,
      dimensions: undefined
    }
  }
}

export const OtherAsset: Story = {
  args: {
    context: 'input',
    asset: {
      ...sampleAsset,
      id: 'asset-5',
      name: 'model.safetensors', // cspell:ignore safetensors
      kind: 'other',
      size: 4294967296,
      thumbnailUrl: undefined,
      dimensions: undefined
    }
  }
}

export const OutputWithJobId: Story = {
  args: {
    context: 'output',
    asset: {
      ...sampleAsset,
      jobId: 'job-123-456'
    }
  }
}

export const LoadingState: Story = {
  args: {
    context: 'input',
    asset: sampleAsset,
    loading: true
  }
}

export const ErrorState: Story = {
  args: {
    context: 'input',
    asset: sampleAsset
  }
}

export const DenseMode: Story = {
  args: {
    context: 'input',
    asset: sampleAsset,
    dense: true
  }
}

export const LongFileName: Story = {
  args: {
    context: 'input',
    asset: {
      ...sampleAsset,
      name: 'very-long-file-name-that-should-be-truncated-in-the-ui-to-prevent-overflow.png'
    }
  }
}

export const WebMVideo: Story = {
  args: {
    context: 'input',
    asset: {
      id: 'asset-webm',
      name: 'animated-clip.webm',
      kind: 'webm',
      size: 3145728,
      timestamp: Date.now(),
      thumbnailUrl: 'https://picsum.photos/640/360?random=webm', // Poster image
      videoUrl: 'https://www.w3schools.com/html/movie.mp4', // Actual video
      duration: 60,
      dimensions: {
        width: 640,
        height: 360
      }
    }
  }
}

export const GifAnimation: Story = {
  args: {
    context: 'input',
    asset: {
      id: 'asset-gif',
      name: 'animation.gif',
      kind: 'gif',
      size: 1572864,
      timestamp: Date.now(),
      thumbnailUrl:
        'https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/giphy.gif',
      dimensions: {
        width: 480,
        height: 270
      }
    }
  }
}

export const WebPImage: Story = {
  args: {
    context: 'input',
    asset: {
      id: 'asset-webp',
      name: 'optimized-image.webp',
      kind: 'webp',
      size: 524288,
      timestamp: Date.now(),
      thumbnailUrl: 'https://www.gstatic.com/webp/gallery/1.webp',
      dimensions: {
        width: 550,
        height: 368
      }
    }
  }
}

export const GridLayout: Story = {
  render: () => ({
    components: { QueueAssetCard },
    setup() {
      const assets: AssetMeta[] = [
        {
          id: 'grid-1',
          name: 'image-file.jpg',
          kind: 'image',
          size: 2097152,
          timestamp: Date.now(),
          thumbnailUrl: 'https://picsum.photos/400/300?random=1',
          dimensions: { width: 1920, height: 1080 }
        },
        {
          id: 'grid-2',
          name: 'video-file.mp4',
          kind: 'video',
          size: 10485760,
          timestamp: Date.now(),
          thumbnailUrl: SAMPLE_MEDIA.videoThumbnail, // Poster image
          videoUrl: SAMPLE_MEDIA.video, // Actual video
          duration: 120,
          dimensions: { width: 1280, height: 720 }
        },
        {
          id: 'grid-3',
          name: 'audio-file.mp3',
          kind: 'audio',
          size: 5242880,
          timestamp: Date.now(),
          thumbnailUrl: SAMPLE_MEDIA.audio,
          duration: 180
        },
        {
          id: 'grid-4',
          name: 'animation.gif',
          kind: 'gif',
          size: 3145728,
          timestamp: Date.now(),
          thumbnailUrl:
            'https://media.giphy.com/media/l0HlNaQ6gWfllcjDO/giphy.gif',
          dimensions: { width: 480, height: 360 }
        }
      ]
      return { assets }
    },
    template: `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; padding: 16px;">
        <QueueAssetCard
          v-for="asset in assets"
          :key="asset.id"
          context="output"
          :asset="asset"
        />
      </div>
    `
  })
}
