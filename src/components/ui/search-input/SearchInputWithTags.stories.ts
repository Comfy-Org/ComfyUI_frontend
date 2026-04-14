import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import SearchInputWithTags from './SearchInputWithTags.vue'

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
  title: 'Components/SearchInputWithTags',
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    components: { SearchInputWithTags },
    setup() {
      const tags = ref<string[]>([])
      const search = ref('')
      return { tags, search, TAG_SUGGESTIONS }
    },
    template: `
      <div class="w-96">
        <SearchInputWithTags
          v-model="tags"
          v-model:query="search"
          :suggestions="TAG_SUGGESTIONS"
          placeholder="Search assets..."
        >
          <template #suggestion="{ suggestion }">
            <span class="text-muted-foreground italic opacity-90">tag:</span>
            <span class="ml-1.5 inline-flex items-center rounded-sm bg-modal-card-tag-background px-2 py-0.5 text-xs text-modal-card-tag-foreground">
              {{ suggestion }}
            </span>
          </template>
        </SearchInputWithTags>
        <div class="mt-4 text-xs text-muted-foreground">
          Tags: {{ tags.length === 0 ? 'none' : tags.join(', ') }}
          <br/>Search: "{{ search }}"
        </div>
      </div>
    `
  })
}

export const WithChips: Story = {
  render: () => ({
    components: { SearchInputWithTags },
    setup() {
      const tags = ref(['landscape', 'anime'])
      const search = ref('')
      return { tags, search, TAG_SUGGESTIONS }
    },
    template: `
      <div class="w-96">
        <SearchInputWithTags
          v-model="tags"
          v-model:query="search"
          :suggestions="TAG_SUGGESTIONS"
          placeholder="Search assets..."
        >
          <template #suggestion="{ suggestion }">
            <span class="text-muted-foreground italic opacity-90">tag:</span>
            <span class="ml-1.5 inline-flex items-center rounded-sm bg-modal-card-tag-background px-2 py-0.5 text-xs text-modal-card-tag-foreground">
              {{ suggestion }}
            </span>
          </template>
        </SearchInputWithTags>
        <div class="mt-4 text-xs text-muted-foreground">
          Tags: {{ tags.join(', ') }}
          <br/>Search: "{{ search }}"
        </div>
      </div>
    `
  })
}

export const NoSuggestions: Story = {
  render: () => ({
    components: { SearchInputWithTags },
    setup() {
      const tags = ref<string[]>([])
      const search = ref('')
      return { tags, search }
    },
    template: `
      <div class="w-96">
        <SearchInputWithTags
          v-model="tags"
          v-model:query="search"
          placeholder="Search assets..."
        />
        <div class="mt-4 text-xs text-muted-foreground">
          Search: "{{ search }}"
        </div>
      </div>
    `
  })
}

export const SizeVariants: Story = {
  render: () => ({
    components: { SearchInputWithTags },
    setup() {
      const sm = ref<string[]>([])
      const md = ref<string[]>([])
      const lg = ref<string[]>([])
      const smQ = ref('')
      const mdQ = ref('')
      const lgQ = ref('')
      return { sm, md, lg, smQ, mdQ, lgQ, TAG_SUGGESTIONS }
    },
    template: `
      <div class="flex flex-col gap-4 w-96">
        <div>
          <div class="text-xs text-muted-foreground mb-1">sm</div>
          <SearchInputWithTags v-model="sm" v-model:query="smQ" :suggestions="TAG_SUGGESTIONS" size="sm" />
        </div>
        <div>
          <div class="text-xs text-muted-foreground mb-1">md (default)</div>
          <SearchInputWithTags v-model="md" v-model:query="mdQ" :suggestions="TAG_SUGGESTIONS" />
        </div>
        <div>
          <div class="text-xs text-muted-foreground mb-1">lg</div>
          <SearchInputWithTags v-model="lg" v-model:query="lgQ" :suggestions="TAG_SUGGESTIONS" size="lg" />
        </div>
      </div>
    `
  })
}

export const Loading: Story = {
  render: () => ({
    components: { SearchInputWithTags },
    setup() {
      const tags = ref<string[]>([])
      const search = ref('')
      return { tags, search }
    },
    template: `
      <div class="w-96">
        <SearchInputWithTags v-model="tags" v-model:query="search" loading placeholder="Loading..." />
      </div>
    `
  })
}

const MIXED_SUGGESTIONS = [
  ...TAG_SUGGESTIONS.map((t) => `tag:${t}`),
  ...['image', 'video', 'audio', '3d', 'text'].map((t) => `type:${t}`)
]

function stripPrefix(value: string): string {
  const idx = value.indexOf(':')
  return idx >= 0 ? value.slice(idx + 1) : value
}

function mixedChipClass(value: string): string {
  if (value.startsWith('type:'))
    return 'bg-primary/15 text-primary border-primary/30'
  return ''
}

export const MixedTagsAndTypes: Story = {
  render: () => ({
    components: { SearchInputWithTags },
    setup() {
      const chips = ref<string[]>([])
      const search = ref('')
      return {
        chips,
        search,
        MIXED_SUGGESTIONS,
        chipClass: mixedChipClass,
        chipLabel: stripPrefix
      }
    },
    template: `
      <div class="w-[500px]">
        <SearchInputWithTags
          v-model="chips"
          v-model:query="search"
          :suggestions="MIXED_SUGGESTIONS"
          :chip-class="chipClass"
          :chip-label="chipLabel"
          :allow-create="false"
          placeholder="Search by tag or type..."
        >
          <template #suggestion="{ suggestion }">
            <span class="text-muted-foreground italic opacity-90">
              {{ suggestion.startsWith('type:') ? 'type:' : 'tag:' }}
            </span>
            <span
              :class="[
                'ml-1.5 inline-flex items-center rounded-sm px-2 py-0.5 text-xs',
                suggestion.startsWith('type:')
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-modal-card-tag-background text-modal-card-tag-foreground'
              ]"
            >
              {{ chipLabel(suggestion) }}
            </span>
          </template>
        </SearchInputWithTags>
        <div class="mt-4 text-xs text-muted-foreground">
          Chips: {{ chips.length === 0 ? 'none' : chips.join(', ') }}
          <br/>Search: "{{ search }}"
        </div>
      </div>
    `
  })
}

export const WithMixedChips: Story = {
  render: () => ({
    components: { SearchInputWithTags },
    setup() {
      const chips = ref(['tag:landscape', 'type:video', 'tag:anime'])
      const search = ref('')
      return {
        chips,
        search,
        MIXED_SUGGESTIONS,
        chipClass: mixedChipClass,
        chipLabel: stripPrefix
      }
    },
    template: `
      <div class="w-[500px]">
        <SearchInputWithTags
          v-model="chips"
          v-model:query="search"
          :suggestions="MIXED_SUGGESTIONS"
          :chip-class="chipClass"
          :chip-label="chipLabel"
          :allow-create="false"
          placeholder="Search..."
        >
          <template #suggestion="{ suggestion }">
            <span class="text-muted-foreground italic opacity-90">
              {{ suggestion.startsWith('type:') ? 'type:' : 'tag:' }}
            </span>
            <span
              :class="[
                'ml-1.5 inline-flex items-center rounded-sm px-2 py-0.5 text-xs',
                suggestion.startsWith('type:')
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-modal-card-tag-background text-modal-card-tag-foreground'
              ]"
            >
              {{ chipLabel(suggestion) }}
            </span>
          </template>
        </SearchInputWithTags>
        <div class="mt-4 text-xs text-muted-foreground">
          Chips: {{ chips.join(', ') }}
          <br/>Search: "{{ search }}"
        </div>
      </div>
    `
  })
}

export const Disabled: Story = {
  render: () => ({
    components: { SearchInputWithTags },
    setup() {
      const tags = ref(['landscape'])
      const search = ref('')
      return { tags, search }
    },
    template: `
      <div class="w-96">
        <SearchInputWithTags v-model="tags" v-model:query="search" disabled placeholder="Disabled" />
      </div>
    `
  })
}
