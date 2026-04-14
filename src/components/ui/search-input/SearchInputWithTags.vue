<template>
  <ComboboxRoot
    v-model="tags"
    v-model:open="isOpen"
    multiple
    ignore-filter
    :disabled
    :class="className"
  >
    <ComboboxAnchor
      ref="anchorRef"
      :class="
        cn(
          searchInputVariants({ size }),
          'gap-1 overflow-hidden',
          disabled && 'pointer-events-none opacity-50'
        )
      "
      @click="focus"
    >
      <!-- Icon / Clear / Spinner — identical to SearchInput -->
      <Button
        v-if="hasContent"
        :class="cn('absolute', sizeConfig.clearPos)"
        variant="textonly"
        size="icon-sm"
        :aria-label="$t('g.clear')"
        @click.stop="clearAll"
      >
        <i :class="cn('icon-[lucide--x]', sizeConfig.icon)" />
      </Button>
      <i
        v-else-if="loading"
        :class="
          cn(
            'pointer-events-none absolute icon-[lucide--loader-circle] animate-spin',
            sizeConfig.iconPos,
            sizeConfig.icon
          )
        "
      />
      <i
        v-else
        :class="
          cn(
            'pointer-events-none absolute',
            sizeConfig.iconPos,
            sizeConfig.icon,
            icon
          )
        "
      />

      <!-- Tag chips + text input -->
      <TagsInputRoot
        v-model="tags"
        delimiter=""
        :disabled
        :display-value="chipLabel"
        :class="
          cn(
            'flex scrollbar-hide min-w-0 flex-1 items-center gap-1 overflow-x-auto',
            sizeConfig.inputPl
          )
        "
      >
        <TagsInputItem
          v-for="tag in tags"
          :key="tag"
          :value="tag"
          :class="
            cn(
              'h-5 shrink-0 rounded-sm py-0 pr-0.5 pl-1.5 text-[10px]',
              'border border-border-default bg-modal-card-tag-background text-modal-card-tag-foreground',
              chipClass?.(tag)
            )
          "
        >
          <TagsInputItemText />
          <TagsInputItemDelete />
        </TagsInputItem>

        <ComboboxInput v-model="query" as-child>
          <TagsInputInput
            :placeholder="hasTags ? '' : placeholderText"
            :is-empty="!hasTags"
            :class="
              cn(
                'min-w-20 flex-1 border-none bg-transparent outline-none',
                sizeConfig.inputText
              )
            "
            @keydown.enter.prevent
          />
        </ComboboxInput>
      </TagsInputRoot>
    </ComboboxAnchor>

    <!-- Suggestion dropdown -->
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
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import TagsInputInput from '@/components/ui/tags-input/TagsInputInput.vue'
import TagsInputItem from '@/components/ui/tags-input/TagsInputItem.vue'
import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import TagsInputItemText from '@/components/ui/tags-input/TagsInputItemText.vue'
import { cn } from '@/utils/tailwindUtil'

import type { SearchInputVariants } from './searchInput.variants'
import {
  searchInputSizeConfig,
  searchInputVariants
} from './searchInput.variants'

const { t } = useI18n()

const {
  suggestions = [],
  placeholder,
  icon = 'icon-[lucide--search]',
  loading = false,
  disabled = false,
  size = 'md',
  caseSensitive = false,
  aliasChars = '-_',
  allowCreate = false,
  chipClass,
  chipLabel,
  class: className
} = defineProps<{
  suggestions?: string[]
  placeholder?: string
  icon?: string
  loading?: boolean
  disabled?: boolean
  size?: SearchInputVariants['size']
  caseSensitive?: boolean
  aliasChars?: string
  allowCreate?: boolean
  /** Returns additional CSS classes for a chip based on its value */
  chipClass?: (value: string) => string
  /** Returns the display text for a chip. Default: show the raw value */
  chipLabel?: (value: string) => string
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{
  'tag-added': [tag: string, isKnown: boolean]
}>()

const tags = defineModel<string[]>({ default: () => [] })
const query = defineModel<string>('query', { default: '' })

const isOpen = ref(false)

const sizeConfig = computed(() => searchInputSizeConfig[size])

const placeholderText = computed(
  () => placeholder ?? t('g.searchPlaceholder', { subject: '' })
)

const anchorRef = ref()

const hasTags = computed(() => tags.value.length > 0)
const hasContent = computed(() => hasTags.value || query.value.length > 0)

function focus() {
  const el = anchorRef.value?.$el ?? anchorRef.value
  if (el instanceof HTMLElement) {
    el.querySelector('input')?.focus()
  }
}

defineExpose({ focus })

function clearAll() {
  tags.value = []
  query.value = ''
  focus()
}

// --- Tag suggestion logic ---

const filterSensitivity = computed(() =>
  caseSensitive ? 'variant' : ('base' as const)
)
const { contains } = useFilter(
  computed(() => ({ sensitivity: filterSensitivity.value }))
)

function normalizeForMatch(value: string): string {
  let result = value
  if (!caseSensitive) result = result.toLowerCase()
  if (aliasChars) {
    const pattern = new RegExp(
      `[${aliasChars.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&')}]`,
      'g'
    )
    result = result.replace(pattern, '')
  }
  return result
}

function resolveTag(typed: string): string {
  const trimmed = typed.trim()
  if (!trimmed) return trimmed
  const normalizedTyped = normalizeForMatch(trimmed)
  return (
    suggestions.find((s) => normalizeForMatch(s) === normalizedTyped) ?? trimmed
  )
}

const filteredSuggestions = computed(() =>
  suggestions.filter((s) => contains(s, query.value) && !tags.value.includes(s))
)

const createTagValue = computed(() => resolveTag(query.value))

const showCreateOption = computed(() => {
  if (!allowCreate) return false
  const trimmed = query.value.trim()
  if (!trimmed) return false
  if (tags.value.includes(createTagValue.value)) return false
  return !filteredSuggestions.value.some(
    (s) => normalizeForMatch(s) === normalizeForMatch(trimmed)
  )
})

const showDropdown = computed(
  () => filteredSuggestions.value.length > 0 || showCreateOption.value
)

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

watch(
  tags,
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
