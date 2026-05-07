import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, nextTick, ref, watch } from 'vue'

import SearchInputWithTags from './SearchInputWithTags.vue'

/**
 * Stories demonstrating property-based search alongside tag and type filters.
 *
 * Property chips use the `prop:` prefix with operator syntax:
 *   prop:resolution>512
 *   prop:artist~John
 *   prop:trained=true
 *
 * Suggestions are context-aware:
 *   Type "prop:" → shows property keys
 *   Type "prop:resolution" → shows operator completions
 *   Type "prop:resolution>" → "Create" option lets user type value + Enter
 */

const PROPERTY_KEYS: Record<string, 'number' | 'string' | 'boolean'> = {
  resolution: 'number',
  steps: 'number',
  cfg: 'number',
  artist: 'string',
  trained: 'boolean'
}

const TAG_SUGGESTIONS = ['landscape', 'portrait', 'anime', 'photo_realistic']
const TYPE_SUGGESTIONS = ['image', 'video', 'audio']

const NUMBER_OPS = ['>', '<', '>=', '<=', '=']
const STRING_OPS = ['~', '=']
const BOOLEAN_VALUES = ['true', 'false']

/**
 * Build context-aware suggestions based on current query text.
 * - No prop prefix → show tag:*, type:*, prop:key
 * - "prop:" → show prop:key for each key
 * - "prop:resolution" → show prop:resolution>, prop:resolution=, etc.
 * - "prop:trained" → show prop:trained=true, prop:trained=false
 */
function buildSuggestions(query: string): string[] {
  const base = [
    ...TAG_SUGGESTIONS.map((t) => `tag:${t}`),
    ...TYPE_SUGGESTIONS.map((t) => `type:${t}`)
  ]

  // Not typing a prop query — show keys as suggestions
  if (!query.startsWith('prop:')) {
    return [...base, ...Object.keys(PROPERTY_KEYS).map((k) => `prop:${k}`)]
  }

  const afterProp = query.slice(5) // strip "prop:"

  // Find if the user has typed a full key
  const matchedKey = Object.keys(PROPERTY_KEYS).find(
    (k) => afterProp === k || afterProp.startsWith(k)
  )

  if (!matchedKey) {
    // Partial key — show matching keys
    return Object.keys(PROPERTY_KEYS)
      .filter((k) => k.startsWith(afterProp))
      .map((k) => `prop:${k}`)
  }

  const afterKey = afterProp.slice(matchedKey.length)
  const type = PROPERTY_KEYS[matchedKey]

  // User typed the key but no operator yet — show operator completions
  if (afterKey === '') {
    if (type === 'boolean') {
      return BOOLEAN_VALUES.map((v) => `prop:${matchedKey}=${v}`)
    }
    const ops = type === 'number' ? NUMBER_OPS : STRING_OPS
    return ops.map((op) => `prop:${matchedKey}${op}`)
  }

  // User typed key + operator — if boolean, suggest values
  if (type === 'boolean' && afterKey === '=') {
    return BOOLEAN_VALUES.map((v) => `prop:${matchedKey}=${v}`)
  }

  // User is typing the value — let "Create" handle it
  return []
}

function chipLabel(value: string): string {
  if (!value.startsWith('prop:')) {
    const idx = value.indexOf(':')
    return idx >= 0 ? value.slice(idx + 1) : value
  }
  const body = value.slice(5)
  const match = body.match(/^(\w+)(>=|<=|>|<|=|~)(.+)$/)
  if (match) {
    const op = match[2] === '~' ? 'contains' : match[2]
    return `${match[1]} ${op} ${match[3]}`
  }
  return body
}

function chipClass(value: string): string {
  if (value.startsWith('type:'))
    return 'bg-primary/15 text-primary border-primary/30'
  if (value.startsWith('prop:'))
    return 'bg-amber-500/15 text-amber-600 border-amber-500/30'
  return ''
}

/** Only allow creating chips for prefixed values with complete expressions */
function canCreateChip(value: string): boolean {
  if (value.startsWith('prop:')) return !!parsePropChip(value)
  if (value.startsWith('tag:') || value.startsWith('type:')) return true
  return false
}

// --- Sample data for filtering demo ---

const SAMPLE_ASSETS = [
  {
    name: 'landscape_001.png',
    tags: ['landscape'],
    type: 'image',
    props: {
      resolution: 1024,
      steps: 30,
      cfg: 7.5,
      artist: 'Alice',
      trained: true
    }
  },
  {
    name: 'portrait_002.png',
    tags: ['portrait'],
    type: 'image',
    props: { resolution: 512, steps: 20, cfg: 5, artist: 'Bob', trained: false }
  },
  {
    name: 'anime_003.png',
    tags: ['anime', 'portrait'],
    type: 'image',
    props: {
      resolution: 768,
      steps: 50,
      cfg: 12,
      artist: 'Charlie',
      trained: true
    }
  },
  {
    name: 'video_004.mp4',
    tags: ['landscape'],
    type: 'video',
    props: {
      resolution: 1920,
      steps: 100,
      cfg: 3,
      artist: 'Alice',
      trained: false
    }
  },
  {
    name: 'lowres_005.png',
    tags: ['photo_realistic'],
    type: 'image',
    props: {
      resolution: 256,
      steps: 10,
      cfg: 4,
      artist: 'Diana',
      trained: true
    }
  }
]

function matchesPropFilter(
  props: Record<string, unknown>,
  key: string,
  op: string,
  target: string
): boolean {
  const value = props[key]
  if (value === undefined) return false
  if (typeof value === 'number') {
    const n = Number(target)
    if (isNaN(n)) return false
    switch (op) {
      case '=':
        return value === n
      case '>':
        return value > n
      case '<':
        return value < n
      case '>=':
        return value >= n
      case '<=':
        return value <= n
    }
  }
  if (typeof value === 'boolean') return value === (target === 'true')
  if (typeof value === 'string') {
    if (op === '~') return value.toLowerCase().includes(target.toLowerCase())
    return value === target
  }
  return false
}

function parsePropChip(
  chip: string
): { key: string; op: string; target: string } | null {
  const body = chip.slice(5)
  const match = body.match(/^(\w+)(>=|<=|>|<|=|~)(.+)$/)
  if (!match) return null
  return { key: match[1], op: match[2], target: match[3] }
}

const meta = {
  title: 'Components/PropertySearch',
  tags: ['autodocs']
} satisfies Meta

export default meta
type Story = StoryObj

export const Default: Story = {
  render: () => ({
    components: { SearchInputWithTags },
    setup() {
      const chips = ref<string[]>([])
      const search = ref('')

      // Dynamic suggestions based on current query
      const suggestions = computed(() => buildSuggestions(search.value))

      // Intercept incomplete prop: chips — redirect back to query
      // for continued editing (e.g. "prop:resolution" needs an operator).
      // Uses nextTick because the component's internal watch clears query
      // synchronously after adding a tag.
      const searchRef = ref<{
        focus: () => void
        openDropdown: () => void
      } | null>(null)
      watch(chips, (newChips, oldChips) => {
        if (!oldChips) return
        const added = newChips.filter((c) => !oldChips.includes(c))
        const incomplete = added.find(
          (c) => c.startsWith('prop:') && !parsePropChip(c)
        )
        if (incomplete) {
          chips.value = newChips.filter((c) => c !== incomplete)
          void nextTick(() => {
            search.value = incomplete
            // Reopen dropdown to show operator suggestions
            void nextTick(() => {
              searchRef.value?.focus()
              searchRef.value?.openDropdown()
            })
          })
        }
      })

      const filtered = computed(() => {
        const tagChips = chips.value
          .filter((c) => c.startsWith('tag:'))
          .map((c) => c.slice(4))
        const typeChips = chips.value
          .filter((c) => c.startsWith('type:'))
          .map((c) => c.slice(5))
        const propChips = chips.value
          .filter((c) => c.startsWith('prop:'))
          .map(parsePropChip)
          .filter(Boolean)

        return SAMPLE_ASSETS.filter((asset) => {
          if (tagChips.length && !tagChips.every((t) => asset.tags.includes(t)))
            return false
          if (typeChips.length && !typeChips.includes(asset.type)) return false
          for (const pf of propChips) {
            if (pf && !matchesPropFilter(asset.props, pf.key, pf.op, pf.target))
              return false
          }
          if (
            search.value &&
            !search.value.startsWith('prop:') &&
            !search.value.startsWith('tag:') &&
            !search.value.startsWith('type:') &&
            !asset.name.toLowerCase().includes(search.value.toLowerCase())
          )
            return false
          return true
        })
      })

      return {
        chips,
        search,
        suggestions,
        chipClass,
        chipLabel,
        canCreateChip,
        filtered,
        searchRef
      }
    },
    template: `
      <div class="w-[600px]">
        <SearchInputWithTags
          ref="searchRef"
          v-model="chips"
          v-model:query="search"
          :suggestions="suggestions"
          :chip-class="chipClass"
          :chip-label="chipLabel"
          :can-create="canCreateChip"
          :allow-create="true"
          placeholder="Search by tag, type, or property..."
        >
          <template #suggestion="{ suggestion }">
            <span class="text-muted-foreground italic opacity-90">
              {{ suggestion.split(':')[0] }}:
            </span>
            <span
              :class="[
                'ml-1.5 inline-flex items-center rounded-sm px-2 py-0.5 text-xs',
                suggestion.startsWith('type:')
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : suggestion.startsWith('prop:')
                    ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                    : 'bg-modal-card-tag-background text-modal-card-tag-foreground'
              ]"
            >
              {{ chipLabel(suggestion) }}
            </span>
          </template>
          <template #create="{ value }">
            <template v-if="value.startsWith('prop:')">
              <span class="italic opacity-90">Filter:</span>
              <span
                class="ml-2 inline-flex items-center rounded-sm bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 border border-amber-500/30"
              >
                {{ chipLabel(value) }}
              </span>
            </template>
            <template v-else>
              <span class="italic opacity-90">Search:</span>
              <span
                class="ml-2 inline-flex items-center rounded-sm bg-modal-card-tag-background px-2 py-0.5 text-xs text-modal-card-tag-foreground"
              >
                {{ value }}
              </span>
            </template>
          </template>
        </SearchInputWithTags>

        <div class="mt-4 text-xs text-muted-foreground">
          Chips: {{ chips.length === 0 ? 'none' : chips.join(', ') }}
          <br/>Search: "{{ search }}"
        </div>

        <div class="mt-4">
          <div class="text-xs font-semibold mb-2">Results ({{ filtered.length }}/5):</div>
          <div v-for="asset in filtered" :key="asset.name" class="flex items-center gap-2 py-1 text-sm">
            <span class="font-mono text-xs">{{ asset.name }}</span>
            <span class="text-muted-foreground text-xs">{{ asset.type }}</span>
            <span v-for="tag in asset.tags" :key="tag" class="rounded-sm bg-modal-card-tag-background px-1.5 py-0.5 text-[10px]">{{ tag }}</span>
            <span class="text-xs text-muted-foreground">res={{ asset.props.resolution }} steps={{ asset.props.steps }}</span>
          </div>
          <div v-if="filtered.length === 0" class="text-muted-foreground text-sm py-2">No matches</div>
        </div>
      </div>
    `
  })
}

export const WithPropertyChips: Story = {
  render: () => ({
    components: { SearchInputWithTags },
    setup() {
      const chips = ref(['prop:resolution>512', 'tag:landscape'])
      const search = ref('')
      const suggestions = computed(() => buildSuggestions(search.value))

      const filtered = computed(() => {
        const tagChips = chips.value
          .filter((c) => c.startsWith('tag:'))
          .map((c) => c.slice(4))
        const propChips = chips.value
          .filter((c) => c.startsWith('prop:'))
          .map(parsePropChip)
          .filter(Boolean)
        return SAMPLE_ASSETS.filter((asset) => {
          if (tagChips.length && !tagChips.every((t) => asset.tags.includes(t)))
            return false
          for (const pf of propChips) {
            if (pf && !matchesPropFilter(asset.props, pf.key, pf.op, pf.target))
              return false
          }
          return true
        })
      })

      return { chips, search, suggestions, chipClass, chipLabel, filtered }
    },
    template: `
      <div class="w-[600px]">
        <SearchInputWithTags
          v-model="chips"
          v-model:query="search"
          :suggestions="suggestions"
          :chip-class="chipClass"
          :chip-label="chipLabel"
          :allow-create="true"
          placeholder="Search..."
        >
          <template #suggestion="{ suggestion }">
            <span class="text-muted-foreground italic opacity-90">
              {{ suggestion.split(':')[0] }}:
            </span>
            <span
              :class="[
                'ml-1.5 inline-flex items-center rounded-sm px-2 py-0.5 text-xs',
                suggestion.startsWith('prop:')
                  ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                  : 'bg-modal-card-tag-background text-modal-card-tag-foreground'
              ]"
            >
              {{ chipLabel(suggestion) }}
            </span>
          </template>
        </SearchInputWithTags>

        <div class="mt-4 text-xs text-muted-foreground">
          Chips: {{ chips.join(', ') }}
        </div>

        <div class="mt-4">
          <div class="text-xs font-semibold mb-2">Filtered: {{ filtered.length }} assets</div>
          <div v-for="asset in filtered" :key="asset.name" class="flex items-center gap-2 py-1 text-sm">
            <span class="font-mono text-xs">{{ asset.name }}</span>
            <span class="text-xs text-muted-foreground">res={{ asset.props.resolution }}</span>
          </div>
          <div v-if="filtered.length === 0" class="text-muted-foreground text-sm py-2">No matches</div>
        </div>
      </div>
    `
  })
}
