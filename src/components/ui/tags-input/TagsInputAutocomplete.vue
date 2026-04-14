<template>
  <ComboboxRoot
    v-model="modelValue"
    v-model:open="isOpen"
    multiple
    ignore-filter
    :disabled
  >
    <ComboboxAnchor as-child>
      <TagsInputRoot
        v-model="modelValue"
        delimiter=""
        :disabled
        :class="
          cn(
            'group relative flex flex-wrap items-center gap-2 rounded-lg bg-transparent p-2 text-xs text-base-foreground',
            !disabled &&
              'focus-within:bg-modal-card-background-hovered hover:bg-modal-card-background-hovered',
            className
          )
        "
      >
        <TagsInputItem
          v-for="tag in modelValue"
          :key="tag"
          :value="tag"
          :class="tagClass?.(tag)"
        >
          <slot name="tag" :tag="tag">
            <TagsInputItemText />
          </slot>
          <TagsInputItemDelete />
        </TagsInputItem>

        <ComboboxInput v-model="query" as-child>
          <TagsInputInput
            :placeholder
            :is-empty="modelValue.length === 0"
            @keydown.enter.prevent
          />
        </ComboboxInput>
      </TagsInputRoot>
    </ComboboxAnchor>

    <ComboboxContent
      v-if="showDropdown"
      position="popper"
      :side-offset="4"
      :class="
        cn(
          'z-50 max-h-60 w-(--reka-combobox-trigger-width) overflow-y-auto',
          'rounded-lg border border-border-default bg-base-background p-1 shadow-lg'
        )
      "
    >
      <ComboboxViewport>
        <ComboboxItem
          v-for="suggestion in filteredSuggestions"
          :key="suggestion"
          :value="suggestion"
          :class="
            cn(
              'cursor-pointer rounded-sm px-3 py-2 text-sm outline-none',
              'data-highlighted:bg-secondary-background-hover'
            )
          "
        >
          <slot
            name="suggestion"
            :suggestion="suggestion"
            :segments="highlightSegments(suggestion, query)"
          >
            <template
              v-for="(seg, i) in highlightSegments(suggestion, query)"
              :key="i"
            >
              <span v-if="seg.bold" class="font-bold">{{ seg.text }}</span>
              <span v-else>{{ seg.text }}</span>
            </template>
          </slot>
        </ComboboxItem>

        <ComboboxItem
          v-if="showCreateOption"
          :value="createTagValue"
          :class="
            cn(
              'cursor-pointer rounded-sm px-3 py-2 text-sm outline-none',
              'data-highlighted:bg-secondary-background-hover',
              'text-muted-foreground'
            )
          "
        >
          <span class="italic opacity-90">{{ $t('g.createTag') }}</span>
          <span
            class="ml-2 inline-flex items-center rounded-sm bg-modal-card-tag-background px-2 py-0.5 text-xs text-modal-card-tag-foreground"
          >
            {{ createTagValue }}
          </span>
        </ComboboxItem>
      </ComboboxViewport>
    </ComboboxContent>
  </ComboboxRoot>
</template>

<script setup lang="ts">
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxRoot,
  ComboboxViewport,
  TagsInputRoot,
  useFilter
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import TagsInputInput from './TagsInputInput.vue'
import TagsInputItem from './TagsInputItem.vue'
import TagsInputItemDelete from './TagsInputItemDelete.vue'
import TagsInputItemText from './TagsInputItemText.vue'

const {
  suggestions = [],
  placeholder,
  disabled = false,
  caseSensitive = false,
  aliasChars = '-_',
  allowCreate = true,
  class: className
} = defineProps<{
  /** Available tag suggestions for the autocomplete dropdown */
  suggestions?: string[]
  placeholder?: string
  disabled?: boolean
  /** When false (default), typed text matches suggestions case-insensitively */
  caseSensitive?: boolean
  /** Characters treated as equivalent when matching against suggestions (e.g. '-' matches '_'). Default: '-_' */
  aliasChars?: string
  /** When true (default), shows "Create new tag" option for unmatched text. Set false for search mode. */
  allowCreate?: boolean
  /** Optional function returning extra CSS classes per tag chip */
  tagClass?: (tag: string) => string | undefined
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  'tag-added': [tag: string, isKnown: boolean]
}>()

const modelValue = defineModel<string[]>({ required: true })
const query = defineModel<string>('query', { default: '' })

const isOpen = ref(false)

const filterSensitivity = computed(() =>
  caseSensitive ? 'variant' : ('base' as const)
)
const { contains } = useFilter(
  computed(() => ({ sensitivity: filterSensitivity.value }))
)

/** Normalize a string for matching: collapse alias chars and optionally lowercase */
function normalizeForMatch(value: string): string {
  let result = value
  if (!caseSensitive) {
    result = result.toLowerCase()
  }
  if (aliasChars) {
    const pattern = new RegExp(
      `[${aliasChars.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}]`,
      'g'
    )
    result = result.replace(pattern, '')
  }
  return result
}

/** Find the canonical suggestion that matches typed input, or return input as-is */
function resolveTag(typed: string): string {
  const trimmed = typed.trim()
  if (!trimmed) return trimmed
  const normalizedTyped = normalizeForMatch(trimmed)
  return (
    suggestions.find((s) => normalizeForMatch(s) === normalizedTyped) ?? trimmed
  )
}

/** Suggestions filtered by current query, excluding already-selected tags */
const filteredSuggestions = computed(() =>
  suggestions.filter(
    (s) => contains(s, query.value) && !modelValue.value.includes(s)
  )
)

/** The resolved value for the "Create custom tag" option */
const createTagValue = computed(() => resolveTag(query.value))

/** Show "Create custom tag" when allowed and typed text doesn't exactly match any visible suggestion */
const showCreateOption = computed(() => {
  if (!allowCreate) return false
  const trimmed = query.value.trim()
  if (!trimmed) return false
  // Don't show if the resolved tag is already selected
  if (modelValue.value.includes(createTagValue.value)) return false
  // Don't show if there's an exact match in the filtered suggestions
  return !filteredSuggestions.value.some(
    (s) => normalizeForMatch(s) === normalizeForMatch(trimmed)
  )
})

/** Show dropdown when there are suggestions or a create option */
const showDropdown = computed(
  () => filteredSuggestions.value.length > 0 || showCreateOption.value
)

/** Split text into segments with bold flag for case-insensitive query matches */
function highlightSegments(
  text: string,
  q: string
): { text: string; bold: boolean }[] {
  if (!q) return [{ text, bold: false }]
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return [{ text, bold: false }]
  const segments: { text: string; bold: boolean }[] = []
  if (idx > 0) segments.push({ text: text.slice(0, idx), bold: false })
  segments.push({ text: text.slice(idx, idx + q.length), bold: true })
  if (idx + q.length < text.length)
    segments.push({ text: text.slice(idx + q.length), bold: false })
  return segments
}

/** Watch for tags added via any path (dropdown select, create option) */
watch(
  modelValue,
  (newVal, oldVal) => {
    if (!oldVal) return
    const added = newVal.filter((t) => !oldVal.includes(t))
    for (const tag of added) {
      emit('tag-added', tag, suggestions.includes(tag))
    }
    query.value = ''
    isOpen.value = false
  },
  { deep: true }
)
</script>
