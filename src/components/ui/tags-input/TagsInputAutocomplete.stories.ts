import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import TagsInputAutocomplete from './TagsInputAutocomplete.vue'

const FRUIT_SUGGESTIONS = [
  'Apple',
  'Banana',
  'Blueberry',
  'Cherry',
  'Grapes',
  'Lemon',
  'Mango',
  'Orange',
  'Peach',
  'Pineapple',
  'Strawberry',
  'Watermelon'
]

const meta: Meta<typeof TagsInputAutocomplete> = {
  title: 'Components/TagsInputAutocomplete',
  component: TagsInputAutocomplete,
  tags: ['autodocs'],
  argTypes: {
    modelValue: {
      control: 'object',
      description: 'Array of selected tag values'
    },
    suggestions: {
      control: 'object',
      description: 'Array of available suggestions'
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the input'
    },
    caseSensitive: {
      control: 'boolean',
      description: 'Case-sensitive matching against suggestions'
    },
    aliasChars: {
      control: 'text',
      description: 'Characters treated as equivalent when matching'
    }
  }
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => ({
    components: { TagsInputAutocomplete },
    setup() {
      const tags = ref(args.modelValue || ['Apple', 'Banana'])
      const log = ref<string[]>([])
      function onTagAdded(tag: string, isKnown: boolean) {
        log.value = [
          `+ "${tag}" (${isKnown ? 'known' : 'custom'})`,
          ...log.value.slice(0, 4)
        ]
      }
      return { tags, log, onTagAdded, args }
    },
    template: `
      <TagsInputAutocomplete
        v-model="tags"
        :suggestions="args.suggestions"
        :disabled="args.disabled"
        :placeholder="args.placeholder"
        class="w-80"
        @tag-added="onTagAdded"
      />
      <div class="mt-4 text-sm text-muted-foreground">
        Selected: {{ tags.join(', ') }}
      </div>
      <div class="mt-2 text-xs text-muted-foreground font-mono">
        <div v-for="(entry, i) in log" :key="i">{{ entry }}</div>
      </div>
    `
  }),
  args: {
    modelValue: ['Apple', 'Banana'],
    suggestions: FRUIT_SUGGESTIONS,
    placeholder: 'Add a fruit...',
    disabled: false
  }
}

export const CustomTags: Story = {
  render: (args) => ({
    components: { TagsInputAutocomplete },
    setup() {
      const tags = ref<string[]>([])
      const log = ref<string[]>([])
      function onTagAdded(tag: string, isKnown: boolean) {
        log.value = [
          `+ "${tag}" (${isKnown ? 'known' : 'custom'})`,
          ...log.value.slice(0, 4)
        ]
      }
      return { tags, log, onTagAdded, args }
    },
    template: `
      <div class="text-sm mb-2">Type "apple" then Enter — normalizes to "Apple"</div>
      <div class="text-sm mb-2">Type "my-custom-tag" then Enter — creates via "Create" option</div>
      <TagsInputAutocomplete
        v-model="tags"
        :suggestions="args.suggestions"
        placeholder="Type and press space..."
        class="w-96"
        @tag-added="onTagAdded"
      />
      <div class="mt-4 text-sm text-muted-foreground">
        Selected: {{ tags.length === 0 ? 'none' : tags.join(', ') }}
      </div>
      <div class="mt-2 text-xs text-muted-foreground font-mono">
        <div v-for="(entry, i) in log" :key="i">{{ entry }}</div>
      </div>
    `
  }),
  args: {
    suggestions: FRUIT_SUGGESTIONS
  }
}

export const AliasMatching: Story = {
  render: (args) => ({
    components: { TagsInputAutocomplete },
    setup() {
      const tags = ref<string[]>([])
      const log = ref<string[]>([])
      function onTagAdded(tag: string, isKnown: boolean) {
        log.value = [
          `+ "${tag}" (${isKnown ? 'known' : 'custom'})`,
          ...log.value.slice(0, 4)
        ]
      }
      return { tags, log, onTagAdded, args }
    },
    template: `
      <div class="text-sm mb-2">Type "dark-fantasy" then space — matches "dark_fantasy"</div>
      <div class="text-sm mb-2">Type "SCIFI" then space — matches "sci-fi" (case + alias)</div>
      <TagsInputAutocomplete
        v-model="tags"
        :suggestions="args.suggestions"
        :alias-chars="args.aliasChars"
        placeholder="Type a genre..."
        class="w-96"
        @tag-added="onTagAdded"
      />
      <div class="mt-4 text-sm text-muted-foreground">
        Selected: {{ tags.length === 0 ? 'none' : tags.join(', ') }}
      </div>
      <div class="mt-2 text-xs text-muted-foreground font-mono">
        <div v-for="(entry, i) in log" :key="i">{{ entry }}</div>
      </div>
    `
  }),
  args: {
    suggestions: [
      'landscape',
      'portrait',
      'dark_fantasy',
      'sci-fi',
      'photo_realistic',
      'low-poly',
      'pixel_art'
    ],
    aliasChars: '-_'
  }
}

export const Empty: Story = {
  render: (args) => ({
    components: { TagsInputAutocomplete },
    setup() {
      const tags = ref<string[]>([])
      return { tags, args }
    },
    template: `
      <TagsInputAutocomplete
        v-model="tags"
        :suggestions="args.suggestions"
        placeholder="Start typing to see suggestions..."
        class="w-80"
      />
      <div class="mt-4 text-sm text-muted-foreground">
        Selected: {{ tags.length === 0 ? 'none' : tags.join(', ') }}
      </div>
    `
  }),
  args: {
    suggestions: FRUIT_SUGGESTIONS
  }
}

export const ManyTags: Story = {
  render: (args) => ({
    components: { TagsInputAutocomplete },
    setup() {
      const tags = ref([
        'Apple',
        'Banana',
        'Cherry',
        'Grapes',
        'Mango',
        'Orange'
      ])
      return { tags, args }
    },
    template: `
      <TagsInputAutocomplete
        v-model="tags"
        :suggestions="args.suggestions"
        placeholder="Add more..."
        class="w-96"
      />
    `
  }),
  args: {
    suggestions: FRUIT_SUGGESTIONS
  }
}

export const Disabled: Story = {
  render: (args) => ({
    components: { TagsInputAutocomplete },
    setup() {
      const tags = ref(['Apple', 'Banana'])
      return { tags, args }
    },
    template: `
      <TagsInputAutocomplete
        v-model="tags"
        :suggestions="args.suggestions"
        placeholder="Cannot edit..."
        disabled
        class="w-80"
      />
    `
  }),
  args: {
    suggestions: FRUIT_SUGGESTIONS
  }
}
