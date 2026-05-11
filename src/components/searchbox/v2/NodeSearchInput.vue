<template>
  <div class="p-3">
    <TagsInputRoot
      :model-value="tagValues"
      delimiter=""
      class="flex cursor-text flex-wrap items-center gap-2 rounded-lg bg-secondary-background px-4 py-3"
      @remove-tag="onRemoveTag"
      @click="inputRef?.focus()"
    >
      <!-- Applied filter chips -->
      <TagsInputItem
        v-for="filter in filters"
        :key="filterKey(filter)"
        :value="filterKey(filter)"
        data-testid="filter-chip"
        class="-my-1 inline-flex items-center gap-1 rounded-lg bg-base-background px-2 py-1 data-[state=active]:ring-2 data-[state=active]:ring-primary"
      >
        <span class="text-sm opacity-80">
          {{ t(`g.${filter.filterDef.id}`) }}:
        </span>
        <span :style="{ color: getLinkTypeColor(filter.value) }"> &bull; </span>
        <span class="text-sm">{{ filter.value }}</span>
        <TagsInputItemDelete
          as="button"
          type="button"
          data-testid="chip-delete"
          :aria-label="$t('g.remove')"
          class="ml-1 flex aspect-square cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-muted-foreground hover:text-base-foreground"
        >
          <i class="icon-[lucide--x] size-3" />
        </TagsInputItemDelete>
      </TagsInputItem>
      <TagsInputInput as-child>
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="true"
          aria-controls="results-list"
          :aria-label="t('g.addNode')"
          :placeholder="t('g.addNode')"
          class="text-foreground h-6 min-w-[min(300px,80vw)] flex-1 border-none bg-transparent font-inter text-sm outline-none placeholder:text-muted-foreground"
          @keydown.enter.prevent="emit('selectCurrent')"
          @keydown.down.prevent="emit('navigateDown')"
          @keydown.up.prevent="emit('navigateUp')"
        />
      </TagsInputInput>
    </TagsInputRoot>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
  TagsInputRoot
} from 'reka-ui'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'
import { getLinkTypeColor } from '@/utils/litegraphUtil'

const { filters } = defineProps<{
  filters: FuseFilterWithValue<ComfyNodeDefImpl, string>[]
}>()

const searchQuery = defineModel<string>('searchQuery', { required: true })

const emit = defineEmits<{
  removeFilter: [filter: FuseFilterWithValue<ComfyNodeDefImpl, string>]
  navigateDown: []
  navigateUp: []
  selectCurrent: []
}>()

const { t } = useI18n()
const inputRef = ref<HTMLInputElement>()

const tagValues = computed(() => filters.map(filterKey))

function filterKey(filter: FuseFilterWithValue<ComfyNodeDefImpl, string>) {
  return `${filter.filterDef.id}:${filter.value}`
}

function onRemoveTag(tagValue: string) {
  const filter = filters.find((f) => filterKey(f) === tagValue)
  if (filter) emit('removeFilter', filter)
}

function focus() {
  inputRef.value?.focus()
}

onMounted(() => {
  focus()
})

defineExpose({ focus })
</script>
