<template>
  <div class="m-0 flex flex-col gap-0 p-0">
    <!-- Type filters -->
    <div
      v-for="filter in typeFilters"
      :key="filter.type"
      class="flex h-10 min-w-32 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-secondary-background-hover"
      tabindex="0"
      role="checkbox"
      :aria-checked="mediaTypeFilters.includes(filter.type)"
      @click="toggleMediaType(filter.type)"
      @keydown.enter.prevent="toggleMediaType(filter.type)"
      @keydown.space.prevent="toggleMediaType(filter.type)"
    >
      <div
        class="flex size-4 shrink-0 items-center justify-center rounded-sm p-0.5 transition-all duration-200"
        :class="
          mediaTypeFilters.includes(filter.type)
            ? 'border-primary-background bg-primary-background'
            : 'bg-secondary-background'
        "
      >
        <i
          v-if="mediaTypeFilters.includes(filter.type)"
          class="icon-[lucide--check] text-xs font-bold text-white"
        />
      </div>
      <span class="text-sm">{{ $t(filter.label) }}</span>
    </div>

    <!-- Tag filters section -->
    <template v-if="tagSuggestions.length > 0">
      <div class="mx-2 my-1 h-px bg-border-default" />

      <div class="px-2 py-1">
        <div
          class="flex items-center gap-2 rounded-lg border border-border-default px-2 py-1"
        >
          <i
            class="icon-[lucide--search] shrink-0 text-xs text-muted-foreground"
          />
          <input
            v-model="tagSearch"
            type="text"
            :placeholder="$t('g.search')"
            class="w-full border-none bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div class="scrollbar-custom max-h-48 overflow-y-auto">
        <div
          v-for="tag in filteredTags"
          :key="tag"
          class="flex h-8 min-w-32 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-secondary-background-hover"
          tabindex="0"
          role="checkbox"
          :aria-checked="selectedTags.includes(tag)"
          @click="toggleTag(tag)"
          @keydown.enter.prevent="toggleTag(tag)"
          @keydown.space.prevent="toggleTag(tag)"
        >
          <div
            class="flex size-4 shrink-0 items-center justify-center rounded-sm p-0.5 transition-all duration-200"
            :class="
              selectedTags.includes(tag)
                ? 'border-primary-background bg-primary-background'
                : 'bg-secondary-background'
            "
          >
            <i
              v-if="selectedTags.includes(tag)"
              class="icon-[lucide--check] text-xs font-bold text-white"
            />
          </div>
          <span class="truncate text-xs">{{ tag }}</span>
        </div>
        <div
          v-if="filteredTags.length === 0 && tagSearch"
          class="px-2 py-3 text-center text-xs text-muted-foreground"
        >
          {{ $t('g.noResultsFound') }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const {
  mediaTypeFilters,
  tagSuggestions = [],
  selectedTags = []
} = defineProps<{
  mediaTypeFilters: string[]
  /** Available tag suggestions for the tag filter section */
  tagSuggestions?: string[]
  /** Currently selected tag filters */
  selectedTags?: string[]
}>()

const emit = defineEmits<{
  'update:mediaTypeFilters': [value: string[]]
  'update:selectedTags': [value: string[]]
}>()

const typeFilters = [
  { type: 'image', label: 'sideToolbar.mediaAssets.filterImage' },
  { type: 'video', label: 'sideToolbar.mediaAssets.filterVideo' },
  { type: 'audio', label: 'sideToolbar.mediaAssets.filterAudio' },
  { type: '3d', label: 'sideToolbar.mediaAssets.filter3D' }
]

const tagSearch = ref('')

const filteredTags = computed(() => {
  if (!tagSearch.value) return tagSuggestions
  const query = tagSearch.value.toLowerCase()
  return tagSuggestions.filter((t) => t.toLowerCase().includes(query))
})

function toggleMediaType(type: string) {
  const isSelected = mediaTypeFilters.includes(type)
  if (isSelected) {
    emit(
      'update:mediaTypeFilters',
      mediaTypeFilters.filter((t) => t !== type)
    )
  } else {
    emit('update:mediaTypeFilters', [...mediaTypeFilters, type])
  }
}

function toggleTag(tag: string) {
  const isSelected = selectedTags.includes(tag)
  if (isSelected) {
    emit(
      'update:selectedTags',
      selectedTags.filter((t) => t !== tag)
    )
  } else {
    emit('update:selectedTags', [...selectedTags, tag])
  }
}
</script>
