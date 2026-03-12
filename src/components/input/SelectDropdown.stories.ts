import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import MultiSelect from './MultiSelect.vue'
import SingleSelect from './SingleSelect.vue'
import type { SelectOption } from './types'

const meta: Meta = {
  title: 'Components/Select/SelectDropdown',
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    () => ({
      template: '<div class="pt-4"><story /></div>'
    })
  ]
}

export default meta
type Story = StoryObj<typeof meta>

const modelOptions: SelectOption[] = [
  { name: 'ACE-Step', value: 'ace-step' },
  { name: 'Anima', value: 'anima' },
  { name: 'BRIA', value: 'bria' },
  { name: 'ByteDance', value: 'bytedance' },
  { name: 'Capybara', value: 'capybara' },
  { name: 'Chatter Box', value: 'chatter-box' },
  { name: 'Chroma', value: 'chroma' },
  { name: 'ChronoEdit', value: 'chronoedit' },
  { name: 'DWPose', value: 'dwpose' },
  { name: 'Depth Anything v2', value: 'depth-anything-v2' },
  { name: 'ElevenLabs', value: 'elevenlabs' },
  { name: 'Flux', value: 'flux' },
  { name: 'HunyuanVideo', value: 'hunyuan-video' },
  { name: 'Stable Diffusion', value: 'stable-diffusion' },
  { name: 'SDXL', value: 'sdxl' }
]

const useCaseOptions: SelectOption[] = [
  { name: 'Text to Image', value: 'text-to-image' },
  { name: 'Image to Image', value: 'image-to-image' },
  { name: 'Inpainting', value: 'inpainting' },
  { name: 'Upscaling', value: 'upscaling' },
  { name: 'Video Generation', value: 'video-generation' },
  { name: 'Audio Generation', value: 'audio-generation' },
  { name: '3D Generation', value: '3d-generation' }
]

const sortOptions: SelectOption[] = [
  { name: 'Default', value: 'default' },
  { name: 'Recommended', value: 'recommended' },
  { name: 'Popular', value: 'popular' },
  { name: 'Newest', value: 'newest' },
  { name: 'VRAM Usage (Low to High)', value: 'vram-low-to-high' },
  { name: 'Model Size (Low to High)', value: 'model-size-low-to-high' },
  { name: 'Alphabetical (A-Z)', value: 'alphabetical' }
]

export const ModelFilter: Story = {
  render: () => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([
        modelOptions[1],
        modelOptions[2],
        modelOptions[3]
      ])
      return { selected, modelOptions }
    },
    template: `
      <MultiSelect
        v-model="selected"
        :options="modelOptions"
        :label="selected.length === 0 ? 'Models' : selected.length === 1 ? selected[0].name : selected.length + ' Models'"
        show-search-box
        show-selected-count
        show-clear-button
        class="w-[250px]"
      >
        <template #icon>
          <i class="icon-[lucide--cpu]" />
        </template>
      </MultiSelect>
    `
  }),
  parameters: { controls: { disable: true } }
}

export const UseCaseFilter: Story = {
  render: () => ({
    components: { MultiSelect },
    setup() {
      const selected = ref<SelectOption[]>([])
      return { selected, useCaseOptions }
    },
    template: `
      <MultiSelect
        v-model="selected"
        :options="useCaseOptions"
        :label="selected.length === 0 ? 'Use Case' : selected.length === 1 ? selected[0].name : selected.length + ' Use Cases'"
        show-search-box
        show-selected-count
        show-clear-button
      >
        <template #icon>
          <i class="icon-[lucide--target]" />
        </template>
      </MultiSelect>
    `
  }),
  parameters: { controls: { disable: true } }
}

export const SortDropdown: Story = {
  render: () => ({
    components: { SingleSelect },
    setup() {
      const selected = ref<string | undefined>('default')
      return { selected, sortOptions }
    },
    template: `
      <SingleSelect
        v-model="selected"
        :options="sortOptions"
        label="Sort by"
        class="w-62.5"
      >
        <template #icon>
          <i class="icon-[lucide--arrow-up-down] text-muted-foreground" />
        </template>
      </SingleSelect>
    `
  }),
  parameters: { controls: { disable: true } }
}

export const TemplateFilterBar: Story = {
  render: () => ({
    components: { MultiSelect, SingleSelect },
    setup() {
      const selectedModels = ref<SelectOption[]>([
        modelOptions[1],
        modelOptions[2],
        modelOptions[3]
      ])
      const selectedUseCases = ref<SelectOption[]>([])
      const sortBy = ref<string | undefined>('default')

      const modelLabel = () => {
        if (selectedModels.value.length === 0) return 'Models'
        if (selectedModels.value.length === 1)
          return selectedModels.value[0].name
        return selectedModels.value.length + ' Models'
      }
      const useCaseLabel = () => {
        if (selectedUseCases.value.length === 0) return 'Use Case'
        if (selectedUseCases.value.length === 1)
          return selectedUseCases.value[0].name
        return selectedUseCases.value.length + ' Use Cases'
      }

      return {
        selectedModels,
        selectedUseCases,
        sortBy,
        modelOptions,
        useCaseOptions,
        sortOptions,
        modelLabel,
        useCaseLabel
      }
    },
    template: `
      <div class="flex flex-wrap items-center justify-between gap-2" style="min-width: 700px;">
        <div class="flex flex-wrap gap-2">
          <MultiSelect
            v-model="selectedModels"
            :options="modelOptions"
            :label="modelLabel()"
            show-search-box
            show-selected-count
            show-clear-button
            class="w-[250px]"
          >
            <template #icon>
              <i class="icon-[lucide--cpu]" />
            </template>
          </MultiSelect>

          <MultiSelect
            v-model="selectedUseCases"
            :options="useCaseOptions"
            :label="useCaseLabel()"
            show-search-box
            show-selected-count
            show-clear-button
          >
            <template #icon>
              <i class="icon-[lucide--target]" />
            </template>
          </MultiSelect>
        </div>

        <SingleSelect
          v-model="sortBy"
          :options="sortOptions"
          label="Sort by"
          class="w-62.5"
        >
          <template #icon>
            <i class="icon-[lucide--arrow-up-down] text-muted-foreground" />
          </template>
        </SingleSelect>
      </div>
    `
  }),
  parameters: { controls: { disable: true } }
}
