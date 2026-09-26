<template>
  <div class="flex w-105 max-w-full flex-col border-t border-border-default">
    <label
      class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm"
    >
      {{ $t('nodeOutputsExport.downloadAll') }}
      <Checkbox
        class="bg-transparent"
        :model-value="allSelected"
        @update:model-value="selectAll"
      />
    </label>
    <ul
      class="m-0 flex max-h-[50vh] list-none flex-col gap-2 overflow-y-auto px-4 py-1"
    >
      <li v-for="(item, index) in items" :key="index">
        <label class="flex cursor-pointer items-center gap-3">
          <img
            :src="item.thumbnailUrl"
            alt=""
            class="size-10 shrink-0 rounded-sm bg-secondary-background object-cover"
          />
          <span class="min-w-0 flex-1 truncate text-sm">{{ item.name }}</span>
          <Checkbox
            class="bg-transparent"
            :model-value="selected[index]"
            @update:model-value="(value) => selectItem(index, value)"
          />
        </label>
      </li>
    </ul>
    <div class="flex justify-end gap-2 p-4">
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button
        variant="inverted"
        :disabled="selectedIndices.length === 0"
        @click="onExport(selectedIndices)"
      >
        {{ $t('nodeOutputsExport.export', { count: selectedIndices.length }) }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'

interface ExportItem {
  name: string
  thumbnailUrl: string
}

const { items, onExport, onCancel } = defineProps<{
  items: ExportItem[]
  onExport: (selectedIndices: number[]) => void
  onCancel: () => void
}>()

const selected = ref(items.map(() => true))

const selectedIndices = computed(() =>
  items.flatMap((_, index) => (selected.value[index] ? [index] : []))
)
const allSelected = computed(
  () => selectedIndices.value.length === items.length
)

function selectAll(value: boolean | 'indeterminate') {
  selected.value = items.map(() => value === true)
}

function selectItem(index: number, value: boolean | 'indeterminate') {
  selected.value = selected.value.map((current, i) =>
    i === index ? value === true : current
  )
}
</script>
