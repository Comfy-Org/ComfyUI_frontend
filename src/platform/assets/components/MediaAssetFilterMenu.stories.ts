import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import MediaAssetFilterMenu from './MediaAssetFilterMenu.vue'

const TAG_SUGGESTIONS = [
  'landscape',
  'portrait',
  'dark_fantasy',
  'sci-fi',
  'photo_realistic',
  'low-poly',
  'pixel_art',
  'anime',
  'watercolor',
  'abstract',
  'cyberpunk',
  'nature',
  'urban',
  'minimalist'
]

const meta = {
  title: 'MediaAssets/FilterMenu',
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    components: { MediaAssetFilterMenu },
    setup() {
      const types = ref<string[]>([])
      const tags = ref<string[]>([])
      return { types, tags, TAG_SUGGESTIONS }
    },
    template: `
      <div class="w-64 rounded-lg bg-base-background p-2">
        <MediaAssetFilterMenu
          :media-type-filters="types"
          :tag-suggestions="TAG_SUGGESTIONS"
          :selected-tags="tags"
          @update:media-type-filters="types = $event"
          @update:selected-tags="tags = $event"
        />
        <div class="mt-4 border-t border-border-default pt-2 text-xs text-muted-foreground">
          Types: {{ types.length === 0 ? 'none' : types.join(', ') }}
          <br/>Tags: {{ tags.length === 0 ? 'none' : tags.join(', ') }}
        </div>
      </div>
    `
  })
}

export const WithSelections: Story = {
  render: () => ({
    components: { MediaAssetFilterMenu },
    setup() {
      const types = ref(['image', 'video'])
      const tags = ref(['landscape', 'anime'])
      return { types, tags, TAG_SUGGESTIONS }
    },
    template: `
      <div class="w-64 rounded-lg bg-base-background p-2">
        <MediaAssetFilterMenu
          :media-type-filters="types"
          :tag-suggestions="TAG_SUGGESTIONS"
          :selected-tags="tags"
          @update:media-type-filters="types = $event"
          @update:selected-tags="tags = $event"
        />
        <div class="mt-4 border-t border-border-default pt-2 text-xs text-muted-foreground">
          Types: {{ types.join(', ') }}
          <br/>Tags: {{ tags.join(', ') }}
        </div>
      </div>
    `
  })
}

export const TypesOnly: Story = {
  render: () => ({
    components: { MediaAssetFilterMenu },
    setup() {
      const types = ref<string[]>([])
      return { types }
    },
    template: `
      <div class="w-64 rounded-lg bg-base-background p-2">
        <MediaAssetFilterMenu
          :media-type-filters="types"
          @update:media-type-filters="types = $event"
        />
        <div class="mt-4 border-t border-border-default pt-2 text-xs text-muted-foreground">
          Types: {{ types.length === 0 ? 'none' : types.join(', ') }}
        </div>
      </div>
    `
  })
}
