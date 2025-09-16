import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import IconButton from '../button/IconButton.vue'
import SquareChip from '../chip/SquareChip.vue'
import CardBottom from './CardBottom.vue'
import CardContainer from './CardContainer.vue'
import CardDescription from './CardDescription.vue'
import CardTitle from './CardTitle.vue'
import CardTop from './CardTop.vue'

interface CardStoryArgs {
  // CardContainer props
  containerRatio: 'square' | 'portrait' | 'tallPortrait'
  maxWidth: number
  minWidth: number

  // CardTop props
  topRatio: 'square' | 'landscape'

  // Content props
  showTopLeft: boolean
  showTopRight: boolean
  showBottomLeft: boolean
  showBottomRight: boolean
  showTitle: boolean
  showDescription: boolean
  title: string
  description: string

  // Visual props
  backgroundColor: string
  showImage: boolean
  imageUrl: string

  // Tag props
  tags: string[]
  showFileSize: boolean
  fileSize: string
  showFileType: boolean
  fileType: string
}

const meta: Meta<CardStoryArgs> = {
  title: 'Components/Card/Card',
  argTypes: {
    containerRatio: {
      control: 'select',
      options: ['square', 'portrait', 'tallPortrait'],
      description: 'Card container aspect ratio'
    },
    topRatio: {
      control: 'select',
      options: ['square', 'landscape'],
      description: 'Top section aspect ratio'
    },
    showTopLeft: {
      control: 'boolean',
      description: 'Show top-left slot content'
    },
    showTopRight: {
      control: 'boolean',
      description: 'Show top-right slot content'
    },
    showBottomLeft: {
      control: 'boolean',
      description: 'Show bottom-left slot content'
    },
    showBottomRight: {
      control: 'boolean',
      description: 'Show bottom-right slot content'
    },
    showTitle: {
      control: 'boolean',
      description: 'Show card title'
    },
    showDescription: {
      control: 'boolean',
      description: 'Show card description'
    },
    title: {
      control: 'text',
      description: 'Card title text'
    },
    description: {
      control: 'text',
      description: 'Card description text'
    },
    backgroundColor: {
      control: 'color',
      description: 'Background color for card top'
    },
    showImage: {
      control: 'boolean',
      description: 'Show image instead of color background'
    },
    imageUrl: {
      control: 'text',
      description: 'Image URL for card top'
    },
    tags: {
      control: 'object',
      description: 'Tags to display (array of strings)'
    },
    showFileSize: {
      control: 'boolean',
      description: 'Show file size tag'
    },
    fileSize: {
      control: 'text',
      description: 'File size text'
    },
    showFileType: {
      control: 'boolean',
      description: 'Show file type tag'
    },
    fileType: {
      control: 'text',
      description: 'File type text'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

const createCardTemplate = (args: CardStoryArgs) => ({
  components: {
    CardContainer,
    CardTop,
    CardBottom,
    CardTitle,
    CardDescription,
    IconButton,
    SquareChip
  },
  setup() {
    const favorited = ref(false)
    const toggleFavorite = () => {
      favorited.value = !favorited.value
    }

    return {
      args,
      favorited,
      toggleFavorite
    }
  },
  template: `
    <div class="min-h-screen">
      <CardContainer 
        :ratio="args.containerRatio" 
        class="max-w-[320px] mx-auto"
      >
        <template #top>
          <CardTop :ratio="args.topRatio">
            <template #default>
              <div 
                v-if="!args.showImage"
                class="w-full h-full"
                :style="{ backgroundColor: args.backgroundColor }"
              ></div>
              <img 
                v-else
                :src="args.imageUrl || 'https://via.placeholder.com/400'"
                class="w-full h-full object-cover"
                alt="Card image"
              />
            </template>
            
            <template v-if="args.showTopLeft" #top-left>
              <SquareChip label="Featured" />
            </template>
            
            <template v-if="args.showTopRight" #top-right>
              <IconButton
                class="!bg-white/90 !text-neutral-900"
                @click="() => console.log('Info clicked')"
              >
                <i class="icon-[lucide--info] size-4" />
              </IconButton>
              <IconButton
                class="!bg-white/90"
                :class="favorited ? '!text-red-500' : '!text-neutral-900'"
                @click="toggleFavorite"
              >
                <i class="icon-[lucide--heart] size-4" :class="favorited ? 'fill-current' : ''" />
              </IconButton>
            </template>
            
            <template v-if="args.showBottomLeft" #bottom-left>
              <SquareChip label="New" />
            </template>
            
            <template v-if="args.showBottomRight" #bottom-right>
              <SquareChip v-if="args.showFileType" :label="args.fileType" />
              <SquareChip v-if="args.showFileSize" :label="args.fileSize" />
              <SquareChip v-for="tag in args.tags" :key="tag" :label="tag">
                <template v-if="tag === 'LoRA'" #icon>
                  <i class="icon-[lucide--folder] size-3" />
                </template>
              </SquareChip>
            </template>
          </CardTop>
        </template>
        
        <template #bottom>
          <CardBottom class="p-3 bg-neutral-100">
            <CardTitle v-if="args.showTitle">{{ args.title }}</CardTitle>
            <CardDescription v-if="args.showDescription">{{ args.description }}</CardDescription>
          </CardBottom>
        </template>
      </CardContainer>
    </div>
  `
})

export const Default: Story = {
  render: (args: CardStoryArgs) => createCardTemplate(args),
  args: {
    containerRatio: 'portrait',
    topRatio: 'square',
    showTopLeft: false,
    showTopRight: true,
    showBottomLeft: false,
    showBottomRight: true,
    showTitle: true,
    showDescription: true,
    title: 'Model Name',
    description:
      'This is a detailed description of the model that can span multiple lines',
    backgroundColor: '#3b82f6',
    showImage: false,
    imageUrl: '',
    tags: ['LoRA', 'SDXL'],
    showFileSize: true,
    fileSize: '1.2 MB',
    showFileType: true,
    fileType: 'safetensors'
  }
}

export const SquareCard: Story = {
  render: (args: CardStoryArgs) => createCardTemplate(args),
  args: {
    containerRatio: 'square',
    topRatio: 'landscape',
    showTopLeft: false,
    showTopRight: true,
    showBottomLeft: false,
    showBottomRight: true,
    showTitle: true,
    showDescription: true,
    title: 'Workflow Bundle',
    description:
      'Complete workflow for image generation with all necessary nodes',
    backgroundColor: '#10b981',
    showImage: false,
    imageUrl: '',
    tags: ['Workflow'],
    showFileSize: true,
    fileSize: '245 KB',
    showFileType: true,
    fileType: 'json'
  }
}

export const TallPortraitCard: Story = {
  render: (args: CardStoryArgs) => createCardTemplate(args),
  args: {
    containerRatio: 'tallPortrait',
    topRatio: 'square',
    showTopLeft: true,
    showTopRight: true,
    showBottomLeft: false,
    showBottomRight: true,
    showTitle: true,
    showDescription: true,
    title: 'Premium Model',
    description:
      'High-quality photorealistic model trained on professional photography',
    backgroundColor: '#8b5cf6',
    showImage: false,
    imageUrl: '',
    tags: ['SD 1.5', 'Checkpoint'],
    showFileSize: true,
    fileSize: '2.1 GB',
    showFileType: true,
    fileType: 'ckpt'
  }
}

export const ImageCard: Story = {
  render: (args: CardStoryArgs) => createCardTemplate(args),
  args: {
    containerRatio: 'portrait',
    topRatio: 'square',
    showTopLeft: false,
    showTopRight: true,
    showBottomLeft: false,
    showBottomRight: true,
    showTitle: true,
    showDescription: true,
    title: 'Generated Image',
    description: 'Created with DreamShaper XL',
    backgroundColor: '#3b82f6',
    showImage: true,
    imageUrl: 'https://picsum.photos/400/400',
    tags: ['Output'],
    showFileSize: true,
    fileSize: '856 KB',
    showFileType: true,
    fileType: 'png'
  }
}

export const MinimalCard: Story = {
  render: (args: CardStoryArgs) => createCardTemplate(args),
  args: {
    containerRatio: 'square',
    topRatio: 'landscape',
    showTopLeft: false,
    showTopRight: false,
    showBottomLeft: false,
    showBottomRight: false,
    showTitle: true,
    showDescription: false,
    title: 'Simple Card',
    description: '',
    backgroundColor: '#64748b',
    showImage: false,
    imageUrl: '',
    tags: [],
    showFileSize: false,
    fileSize: '',
    showFileType: false,
    fileType: ''
  }
}

export const FullFeaturedCard: Story = {
  render: (args: CardStoryArgs) => createCardTemplate(args),
  args: {
    containerRatio: 'tallPortrait',
    topRatio: 'square',
    showTopLeft: true,
    showTopRight: true,
    showBottomLeft: true,
    showBottomRight: true,
    showTitle: true,
    showDescription: true,
    title: 'Ultimate Model Pack',
    description:
      'Complete collection with checkpoints, LoRAs, embeddings, and VAE models for professional use',
    backgroundColor: '#ef4444',
    showImage: false,
    imageUrl: '',
    tags: ['Bundle', 'SDXL'],
    showFileSize: true,
    fileSize: '5.4 GB',
    showFileType: true,
    fileType: 'pack'
  }
}
