<template>
  <div data-block-keyboard-shortcuts data-testid="input-tags" class="contents">
    <PopoverRoot v-model:open="isOpen">
      <PopoverAnchor as-child>
        <TagsInputRoot
          :model-value="modelValue"
          :disabled
          delimiter=""
          class="group relative flex min-h-6 min-w-0 flex-1 flex-wrap items-center gap-2 rounded-lg bg-transparent p-2 text-xs text-base-foreground focus-within:bg-modal-card-background-hovered hover:bg-modal-card-background-hovered"
          @update:model-value="emit('update:modelValue', $event)"
        >
          <TagsInputItem
            v-for="tag in modelValue"
            :key="tag"
            :value="tag"
            class="flex h-6 items-center gap-1 rounded-sm bg-modal-card-tag-background py-1 pr-1 pl-2 text-modal-card-tag-foreground ring-offset-base-background backdrop-blur-sm"
          >
            <TagsInputItemText />
            <TagsInputItemDelete />
          </TagsInputItem>
          <TagsInputInput as-child>
            <input
              ref="inputRef"
              v-model="inputValue"
              type="text"
              :placeholder="placeholder"
              class="min-h-6 min-w-[120px] flex-1 appearance-none border-none bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground focus:outline-none"
              autocomplete="off"
              @keydown.enter="onEnter"
              @keydown.escape="onEscape"
              @keydown.down="onArrowDown"
              @keydown.up="onArrowUp"
            />
          </TagsInputInput>
        </TagsInputRoot>
      </PopoverAnchor>

      <PopoverPortal>
        <PopoverContent
          v-if="isOpen && filteredSuggestions.length > 0"
          side="bottom"
          :side-offset="4"
          :collision-padding="10"
          class="data-[state=open]:data-[side=bottom]:animate-slideUpAndFade z-1700 max-h-60 min-w-48 overflow-y-auto rounded-lg border border-border-default bg-base-background p-1 shadow-lg"
          @open-auto-focus.prevent
        >
          <button
            v-for="(suggestion, index) in filteredSuggestions"
            :key="`${suggestion}-${index}`"
            type="button"
            data-testid="suggestion-item"
            :class="
              cn(
                'flex w-full cursor-pointer rounded-md border-none bg-transparent px-3 py-2 text-left text-sm outline-none',
                index === selectedIndex
                  ? 'bg-secondary-background-hover'
                  : 'hover:bg-secondary-background-hover'
              )
            "
            @mousedown.prevent="onSelectSuggestion(suggestion)"
          >
            {{ suggestion }}
          </button>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>

<script setup lang="ts">
import {
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  TagsInputInput,
  TagsInputItem,
  TagsInputItemText,
  TagsInputRoot
} from 'reka-ui'

import TagsInputItemDelete from '@/components/ui/tags-input/TagsInputItemDelete.vue'
import { cn } from '@/utils/tailwindUtil'
import { computed, ref, watch } from 'vue'

import { COMFY_HUB_TAG_OPTIONS } from '@/platform/workflow/sharing/constants/comfyHubTags'

const { placeholder = 'Add tags...', disabled = false } = defineProps<{
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const modelValue = defineModel<string[]>({ required: true })
const inputRef = ref<HTMLInputElement | null>(null)
const inputValue = ref('')
const isOpen = ref(false)
const selectedIndex = ref(-1)

const filteredSuggestions = computed(() => {
  const query = inputValue.value.trim().toLowerCase()
  if (!query) return []
  const selected = new Set(modelValue.value)
  return COMFY_HUB_TAG_OPTIONS.filter(
    (tag) => !selected.has(tag) && tag.toLowerCase().includes(query)
  ).slice(0, 20)
})

function addTag(tag: string) {
  const trimmed = tag.trim()
  if (!trimmed || modelValue.value.includes(trimmed)) return
  emit('update:modelValue', [...modelValue.value, trimmed])
  inputValue.value = ''
  isOpen.value = false
}

function onSelectSuggestion(suggestion: string) {
  addTag(suggestion)
}

function onArrowDown(e: KeyboardEvent) {
  const suggestions = filteredSuggestions.value
  if (suggestions.length === 0) return
  e.preventDefault()
  selectedIndex.value =
    selectedIndex.value < suggestions.length - 1 ? selectedIndex.value + 1 : 0
}

function onArrowUp(e: KeyboardEvent) {
  const suggestions = filteredSuggestions.value
  if (suggestions.length === 0) return
  e.preventDefault()
  selectedIndex.value =
    selectedIndex.value > 0 ? selectedIndex.value - 1 : suggestions.length - 1
}

function onEnter(e: KeyboardEvent) {
  e.preventDefault()
  const suggestions = filteredSuggestions.value
  if (suggestions.length > 0) {
    const idx = selectedIndex.value >= 0 ? selectedIndex.value : 0
    addTag(suggestions[idx])
  } else if (inputValue.value.trim()) {
    addTag(inputValue.value)
  }
}

function onEscape() {
  inputValue.value = ''
  isOpen.value = false
  selectedIndex.value = -1
  inputRef.value?.blur()
}

watch(inputValue, () => {
  selectedIndex.value = -1
})

watch(
  () => [inputValue.value, filteredSuggestions.value] as const,
  ([val, suggestions]) => {
    const list = suggestions as string[]
    isOpen.value = !!val && list.length > 0
    if (selectedIndex.value >= list.length) selectedIndex.value = -1
  }
)
</script>
