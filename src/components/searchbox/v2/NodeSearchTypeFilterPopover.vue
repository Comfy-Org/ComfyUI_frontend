<template>
  <PopoverRoot v-model:open="open" @update:open="onOpenChange">
    <PopoverTrigger as-child>
      <slot />
    </PopoverTrigger>
    <PopoverContent
      side="bottom"
      :side-offset="4"
      :collision-padding="10"
      class="data-[state=open]:data-[side=bottom]:animate-slideUpAndFade z-1001 w-64 rounded-lg border border-border-default bg-base-background px-4 py-1 shadow-interface will-change-[transform,opacity]"
      @open-auto-focus="onOpenAutoFocus"
      @close-auto-focus="onCloseAutoFocus"
      @escape-key-down.prevent
      @keydown.escape.stop="closeWithEscape"
    >
      <ListboxRoot
        multiple
        selection-behavior="toggle"
        :model-value="selectedValues"
        @update:model-value="onSelectionChange"
      >
        <div
          class="mt-2 flex h-8 items-center gap-2 rounded-sm border border-border-default px-2"
        >
          <i
            class="icon-[lucide--search] size-4 shrink-0 text-muted-foreground"
          />
          <ListboxFilter
            ref="searchFilterRef"
            v-model="searchQuery"
            :placeholder="t('g.search')"
            class="text-foreground size-full border-none bg-transparent font-inter text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div class="flex items-center justify-between py-3">
          <span class="text-sm text-muted-foreground">
            {{
              t(
                'g.itemsSelected',
                { count: selectedValues.length },
                selectedValues.length
              )
            }}
          </span>
          <button
            v-if="selectedValues.length > 0"
            type="button"
            class="cursor-pointer border-none bg-transparent font-inter text-sm text-base-foreground"
            @click="emit('clear')"
          >
            {{ t('g.clearAll') }}
          </button>
        </div>

        <div class="h-px bg-border-default" />

        <ListboxContent class="max-h-64 overflow-y-auto py-3">
          <ListboxItem
            v-for="option in filteredOptions"
            :key="option"
            :value="option"
            data-testid="filter-option"
            class="text-foreground flex cursor-pointer items-center gap-2 rounded-sm px-1 py-2 text-sm outline-none data-highlighted:bg-secondary-background-hover"
          >
            <span
              :class="
                cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-sm border border-border-default',
                  selectedSet.has(option) &&
                    'text-primary-foreground border-primary bg-primary'
                )
              "
            >
              <i
                v-if="selectedSet.has(option)"
                class="icon-[lucide--check] size-3"
              />
            </span>
            <span class="truncate">{{ option }}</span>
            <span
              class="mr-1 ml-auto text-lg leading-none"
              :style="{ color: getLinkTypeColor(option) }"
            >
              &bull;
            </span>
          </ListboxItem>
          <div
            v-if="filteredOptions.length === 0"
            class="px-1 py-4 text-center text-sm text-muted-foreground"
          >
            {{ t('g.noResults') }}
          </div>
        </ListboxContent>
      </ListboxRoot>
    </PopoverContent>
  </PopoverRoot>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AcceptableValue } from 'reka-ui'
import {
  ListboxContent,
  ListboxFilter,
  ListboxItem,
  ListboxRoot,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'

import type { FilterChip } from '@/components/searchbox/v2/NodeSearchFilterBar.vue'
import { getLinkTypeColor } from '@/utils/litegraphUtil'
import { cn } from '@/utils/tailwindUtil'

const { chip, selectedValues } = defineProps<{
  chip: FilterChip
  selectedValues: string[]
}>()

const emit = defineEmits<{
  toggle: [value: string]
  clear: []
  escapeClose: []
}>()

const { t } = useI18n()
const open = ref(false)
const closedWithEscape = ref(false)
const searchQuery = ref('')
const searchFilterRef = ref<InstanceType<typeof ListboxFilter>>()

function onOpenChange(isOpen: boolean) {
  if (!isOpen) searchQuery.value = ''
}

const selectedSet = computed(() => new Set(selectedValues))

function onSelectionChange(value: AcceptableValue) {
  const newValues = value as string[]
  const added = newValues.find((v) => !selectedSet.value.has(v))
  const removed = selectedValues.find((v) => !newValues.includes(v))
  const toggled = added ?? removed
  if (toggled) emit('toggle', toggled)
}

const filteredOptions = computed(() => {
  const { fuseSearch } = chip.filter
  if (searchQuery.value) {
    return fuseSearch.search(searchQuery.value).slice(0, 64)
  }
  return fuseSearch.data.slice().sort()
})

function closeWithEscape() {
  closedWithEscape.value = true
  open.value = false
}

function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  const el = searchFilterRef.value?.$el as HTMLInputElement | undefined
  el?.focus()
}

function onCloseAutoFocus(event: Event) {
  if (closedWithEscape.value) {
    event.preventDefault()
    closedWithEscape.value = false
    emit('escapeClose')
  }
}
</script>
