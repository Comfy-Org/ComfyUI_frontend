import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import TagsInputAutocomplete from '@/components/ui/tags-input/TagsInputAutocomplete.vue'

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
  'abstract'
]

const meta = {
  title: 'Components/SearchWithTagFilters',
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    components: { TagsInputAutocomplete },
    setup() {
      const filterTags = ref<string[]>([])
      const searchText = ref('')
      return { filterTags, searchText, TAG_SUGGESTIONS }
    },
    template: `
      <div class="w-96">
        <TagsInputAutocomplete
          v-model="filterTags"
          v-model:query="searchText"
          :suggestions="TAG_SUGGESTIONS"
          :allow-create="false"
          placeholder="Search or filter by tag..."
          class="bg-secondary-background rounded-lg"
        >
          <template #suggestion="{ suggestion }">
            <span class="text-muted-foreground italic opacity-90">tag:</span>
            <span class="ml-1.5 inline-flex items-center rounded-sm bg-modal-card-tag-background px-2 py-0.5 text-xs text-modal-card-tag-foreground">
              {{ suggestion }}
            </span>
          </template>
        </TagsInputAutocomplete>
        <div class="mt-4 text-sm text-muted-foreground">
          Tags: {{ filterTags.length === 0 ? 'none' : filterTags.join(', ') }}
        </div>
        <div class="mt-1 text-sm text-muted-foreground">
          Search: "{{ searchText }}"
        </div>
      </div>
    `
  })
}

export const WithSelectedTags: Story = {
  render: () => ({
    components: { TagsInputAutocomplete },
    setup() {
      const filterTags = ref(['landscape', 'anime'])
      const searchText = ref('')
      return { filterTags, searchText, TAG_SUGGESTIONS }
    },
    template: `
      <div class="w-96">
        <TagsInputAutocomplete
          v-model="filterTags"
          v-model:query="searchText"
          :suggestions="TAG_SUGGESTIONS"
          :allow-create="false"
          placeholder="Add more tags..."
          class="bg-secondary-background rounded-lg"
        >
          <template #suggestion="{ suggestion }">
            <span class="text-muted-foreground italic opacity-90">tag:</span>
            <span class="ml-1.5 inline-flex items-center rounded-sm bg-modal-card-tag-background px-2 py-0.5 text-xs text-modal-card-tag-foreground">
              {{ suggestion }}
            </span>
          </template>
        </TagsInputAutocomplete>
        <div class="mt-4 text-sm text-muted-foreground">
          Tags: {{ filterTags.join(', ') }}
        </div>
        <div class="mt-1 text-sm text-muted-foreground">
          Search: "{{ searchText }}"
        </div>
      </div>
    `
  })
}
