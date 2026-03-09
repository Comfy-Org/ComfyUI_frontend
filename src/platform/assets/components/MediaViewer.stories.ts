import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { AssetItem } from '../schemas/assetSchema'
import MediaViewer from './MediaViewer.vue'

const SAMPLE_MEDIA = {
  image1: 'https://i.imgur.com/OB0y6MR.jpg',
  image2: 'https://i.imgur.com/CzXTtJV.jpg',
  image3: 'https://farm9.staticflickr.com/8505/8441256181_4e98d8bff5_z_d.jpg',
  video:
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
}

function makeAsset(
  overrides: Partial<AssetItem> & { id: string; name: string }
): AssetItem {
  return {
    size: 0,
    created_at: new Date().toISOString(),
    tags: ['output'],
    preview_url: '',
    ...overrides
  }
}

const singleImage: AssetItem[] = [
  makeAsset({
    id: 'img-1',
    name: 'landscape.jpg',
    preview_url: SAMPLE_MEDIA.image1
  })
]

const multipleImages: AssetItem[] = [
  makeAsset({
    id: 'img-1',
    name: 'landscape.jpg',
    preview_url: SAMPLE_MEDIA.image1
  }),
  makeAsset({
    id: 'img-2',
    name: 'portrait.jpg',
    preview_url: SAMPLE_MEDIA.image2
  }),
  makeAsset({
    id: 'img-3',
    name: 'nature.jpg',
    preview_url: SAMPLE_MEDIA.image3
  })
]

const mixedMedia: AssetItem[] = [
  makeAsset({
    id: 'img-1',
    name: 'photo.jpg',
    preview_url: SAMPLE_MEDIA.image1
  }),
  makeAsset({
    id: 'vid-1',
    name: 'clip.mp4',
    preview_url: SAMPLE_MEDIA.video
  }),
  makeAsset({
    id: 'aud-1',
    name: 'song.mp3',
    preview_url: SAMPLE_MEDIA.audio
  })
]

const meta: Meta<typeof MediaViewer> = {
  title: 'Platform/Assets/MediaViewer',
  component: MediaViewer,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    activeIndex: { control: { type: 'number', min: -1, max: 10 } }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const SingleImage: Story = {
  args: {
    items: singleImage,
    activeIndex: 0
  }
}

export const MultipleImages: Story = {
  args: {
    items: multipleImages,
    activeIndex: 0
  }
}

export const VideoPlayer: Story = {
  args: {
    items: [
      makeAsset({
        id: 'vid-1',
        name: 'big-buck-bunny.mp4',
        preview_url: SAMPLE_MEDIA.video
      })
    ],
    activeIndex: 0
  }
}

export const AudioPlayer: Story = {
  args: {
    items: [
      makeAsset({
        id: 'aud-1',
        name: 'soundtrack.mp3',
        preview_url: SAMPLE_MEDIA.audio
      })
    ],
    activeIndex: 0
  }
}

export const MixedMedia: Story = {
  args: {
    items: mixedMedia,
    activeIndex: 0
  }
}

export const Closed: Story = {
  args: {
    items: singleImage,
    activeIndex: -1
  }
}
