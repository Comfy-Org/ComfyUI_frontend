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
    maxWidth: {
      control: { type: 'range', min: 200, max: 600, step: 10 },
      description: 'Maximum width in pixels'
    },
    minWidth: {
      control: { type: 'range', min: 150, max: 400, step: 10 },
      description: 'Minimum width in pixels'
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
    <div class="p-4 min-h-screen bg-zinc-50 dark-theme:bg-zinc-900">
      <CardContainer 
        :ratio="args.containerRatio" 
        :max-width="args.maxWidth"
        :min-width="args.minWidth"
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
          <CardBottom class="p-3">
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
    maxWidth: 300,
    minWidth: 200,
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
    maxWidth: 400,
    minWidth: 250,
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
    maxWidth: 280,
    minWidth: 180,
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
    maxWidth: 350,
    minWidth: 220,
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
    maxWidth: 300,
    minWidth: 200,
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
    maxWidth: 320,
    minWidth: 240,
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
    tags: ['Bundle', 'Premium', 'SDXL'],
    showFileSize: true,
    fileSize: '5.4 GB',
    showFileType: true,
    fileType: 'pack'
  }
}

export const GridOfCards: Story = {
  render: () => ({
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
      const cards = ref([
        {
          id: 1,
          title: 'Realistic Vision',
          description: 'Photorealistic model for portraits',
          color: 'from-blue-400 to-blue-600',
          ratio: 'portrait' as const,
          tags: ['SD 1.5'],
          size: '2.1 GB'
        },
        {
          id: 2,
          title: 'DreamShaper XL',
          description: 'Artistic style model with enhanced details',
          color: 'from-purple-400 to-pink-600',
          ratio: 'portrait' as const,
          tags: ['SDXL'],
          size: '6.5 GB'
        },
        {
          id: 3,
          title: 'Anime LoRA',
          description: 'Character style LoRA',
          color: 'from-green-400 to-teal-600',
          ratio: 'portrait' as const,
          tags: ['LoRA'],
          size: '144 MB'
        },
        {
          id: 4,
          title: 'VAE Model',
          description: 'Enhanced color VAE',
          color: 'from-orange-400 to-red-600',
          ratio: 'portrait' as const,
          tags: ['VAE'],
          size: '335 MB'
        },
        {
          id: 5,
          title: 'Workflow Bundle',
          description: 'Complete workflow setup',
          color: 'from-indigo-400 to-blue-600',
          ratio: 'portrait' as const,
          tags: ['Workflow'],
          size: '45 KB'
        },
        {
          id: 6,
          title: 'Embedding Pack',
          description: 'Negative embeddings collection',
          color: 'from-yellow-400 to-orange-600',
          ratio: 'portrait' as const,
          tags: ['Embedding'],
          size: '2.3 MB'
        }
      ])

      return { cards }
    },
    template: `
      <div class="p-4 min-h-screen bg-zinc-50 dark-theme:bg-zinc-900">
        <h3 class="text-lg font-semibold mb-4 text-neutral-900 dark-theme:text-neutral-100">Model Gallery</h3>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <CardContainer 
            v-for="card in cards" 
            :key="card.id"
            :ratio="card.ratio"
            :max-width="300"
            :min-width="180"
          >
            <template #top>
              <CardTop ratio="square">
                <template #default>
                  <div 
                    class="w-full h-full bg-gray-600"
                    :class="card.color"
                  ></div>
                </template>
                
                <template #top-right>
                  <IconButton
                    class="!bg-white/90 !text-neutral-900"
                    @click="() => console.log('Info:', card.title)"
                  >
                    <i class="icon-[lucide--info] size-4" />
                  </IconButton>
                </template>
                
                <template #bottom-right>
                  <SquareChip 
                    v-for="tag in card.tags" 
                    :key="tag" 
                    :label="tag"
                  >
                    <template v-if="tag === 'LoRA'" #icon>
                      <i class="icon-[lucide--folder] size-3" />
                    </template>
                  </SquareChip>
                  <SquareChip :label="card.size" />
                </template>
              </CardTop>
            </template>
            
            <template #bottom>
              <CardBottom class="p-3">
                <CardTitle>{{ card.title }}</CardTitle>
                <CardDescription>{{ card.description }}</CardDescription>
              </CardBottom>
            </template>
          </CardContainer>
        </div>
      </div>
    `
  })
}

export const ResponsiveGrid: Story = {
  render: () => ({
    components: {
      CardContainer,
      CardTop,
      CardBottom,
      CardTitle,
      CardDescription,
      SquareChip
    },
    setup() {
      const generateCards = (
        count: number,
        ratio: 'square' | 'portrait' | 'tallPortrait'
      ) => {
        return Array.from({ length: count }, (_, i) => ({
          id: i + 1,
          title: `Model ${i + 1}`,
          description: `Description for model ${i + 1}`,
          ratio,
          color: `hsl(${(i * 60) % 360}, 70%, 60%)`
        }))
      }

      const squareCards = ref(generateCards(4, 'square'))
      const portraitCards = ref(generateCards(6, 'portrait'))
      const tallCards = ref(generateCards(5, 'tallPortrait'))

      return {
        squareCards,
        portraitCards,
        tallCards
      }
    },
    template: `
      <div class="p-4 space-y-8 min-h-screen bg-zinc-50 dark-theme:bg-zinc-900">
        <div>
          <h3 class="text-lg font-semibold mb-4 text-neutral-900 dark-theme:text-neutral-100">Square Cards (1:1)</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <CardContainer 
              v-for="card in squareCards" 
              :key="card.id"
              :ratio="card.ratio"
              :max-width="400"
              :min-width="200"
            >
              <template #top>
                <CardTop ratio="landscape">
                  <div 
                    class="w-full h-full"
                    :style="{ backgroundColor: card.color }"
                  ></div>
                </CardTop>
              </template>
              <template #bottom>
                <CardBottom class="p-3">
                  <CardTitle>{{ card.title }}</CardTitle>
                  <CardDescription>{{ card.description }}</CardDescription>
                </CardBottom>
              </template>
            </CardContainer>
          </div>
        </div>

        <div>
          <h3 class="text-lg font-semibold mb-4 text-neutral-900 dark-theme:text-neutral-100">Portrait Cards (2:3)</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <CardContainer 
              v-for="card in portraitCards" 
              :key="card.id"
              :ratio="card.ratio"
              :max-width="280"
              :min-width="160"
            >
              <template #top>
                <CardTop ratio="square">
                  <div 
                    class="w-full h-full"
                    :style="{ backgroundColor: card.color }"
                  ></div>
                </CardTop>
              </template>
              <template #bottom>
                <CardBottom class="p-2">
                  <CardTitle>{{ card.title }}</CardTitle>
                </CardBottom>
              </template>
            </CardContainer>
          </div>
        </div>

        <div>
          <h3 class="text-lg font-semibold mb-4 text-neutral-900 dark-theme:text-neutral-100">Tall Portrait Cards (2:4)</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <CardContainer 
              v-for="card in tallCards" 
              :key="card.id"
              :ratio="card.ratio"
              :max-width="260"
              :min-width="150"
            >
              <template #top>
                <CardTop ratio="square">
                  <template #default>
                    <div 
                      class="w-full h-full"
                      :style="{ backgroundColor: card.color }"
                    ></div>
                  </template>
                  <template #bottom-right>
                    <SquareChip :label="'#' + card.id" />
                  </template>
                </CardTop>
              </template>
              <template #bottom>
                <CardBottom class="p-3">
                  <CardTitle>{{ card.title }}</CardTitle>
                  <CardDescription>{{ card.description }}</CardDescription>
                </CardBottom>
              </template>
            </CardContainer>
          </div>
        </div>
      </div>
    `
  }),
  parameters: {
    controls: { disable: true },
    actions: { disable: true }
  }
}
