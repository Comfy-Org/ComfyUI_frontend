import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'

import { highlightQuery } from '@/utils/formatUtil'

import SearchAutocomplete from './SearchAutocomplete.vue'

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
  title: 'Components/SearchAutocompleteTagSuggestions',
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    components: { SearchAutocomplete },
    setup() {
      const query = ref('')
      const allTags = TAG_SUGGESTIONS

      const filteredTags = computed(() => {
        const stripped = query.value.replace(/^tag:\s*/i, '').trim()
        if (!stripped) return allTags
        const lower = stripped.toLowerCase()
        return allTags.filter((t) => t.toLowerCase().includes(lower))
      })

      function onSelect(tag: string) {
        query.value = `tag: ${tag}`
      }

      function highlight(text: string) {
        const stripped = query.value.replace(/^tag:\s*/i, '').trim()
        return highlightQuery(text, stripped)
      }

      return { query, filteredTags, onSelect, highlight }
    },
    template: `
      <div class="w-96">
        <SearchAutocomplete
          v-model="query"
          :suggestions="filteredTags"
          placeholder="Search assets..."
          @select="onSelect"
        >
          <template #suggestion="{ suggestion }">
            <span class="italic opacity-90 text-muted-foreground">tag:</span>
            <span
              class="ml-1.5 inline-flex items-center rounded-sm bg-modal-card-tag-background px-2 py-0.5 text-xs text-modal-card-tag-foreground"
              v-html="highlight(suggestion)"
            />
          </template>
        </SearchAutocomplete>
        <div class="mt-4 text-sm text-muted-foreground">
          Query: "{{ query }}"
        </div>
      </div>
    `
  })
}

export const WithPartialMatch: Story = {
  render: () => ({
    components: { SearchAutocomplete },
    setup() {
      const query = ref('land')
      const allTags = TAG_SUGGESTIONS

      const filteredTags = computed(() => {
        const stripped = query.value.replace(/^tag:\s*/i, '').trim()
        if (!stripped) return allTags
        const lower = stripped.toLowerCase()
        return allTags.filter((t) => t.toLowerCase().includes(lower))
      })

      function onSelect(tag: string) {
        query.value = `tag: ${tag}`
      }

      function highlight(text: string) {
        const stripped = query.value.replace(/^tag:\s*/i, '').trim()
        return highlightQuery(text, stripped)
      }

      return { query, filteredTags, onSelect, highlight }
    },
    template: `
      <div class="w-96">
        <SearchAutocomplete
          v-model="query"
          :suggestions="filteredTags"
          placeholder="Search assets..."
          @select="onSelect"
        >
          <template #suggestion="{ suggestion }">
            <span class="italic opacity-90 text-muted-foreground">tag:</span>
            <span
              class="ml-1.5 inline-flex items-center rounded-sm bg-modal-card-tag-background px-2 py-0.5 text-xs text-modal-card-tag-foreground"
              v-html="highlight(suggestion)"
            />
          </template>
        </SearchAutocomplete>
        <div class="mt-4 text-sm text-muted-foreground">
          Query: "{{ query }}"
        </div>
      </div>
    `
  })
}
