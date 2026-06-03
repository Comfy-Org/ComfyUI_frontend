<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import AsyncSearchInput from '@/components/ui/search-input/AsyncSearchInput.vue'
import Button from '@/components/ui/button/Button.vue'
import type {
  FilterOption,
  OwnershipFilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'

import FormDropdownActionPopover from './FormDropdownActionPopover.vue'
import type { SortOption } from './types'

const { t } = useI18n()

defineProps<{
  sortOptions: SortOption[]
  showOwnershipFilter?: boolean
  ownershipOptions?: OwnershipFilterOption[]
  showBaseModelFilter?: boolean
  baseModelOptions?: FilterOption[]
  candidateLabel?: string
}>()

const emit = defineEmits<{
  (e: 'search-enter'): void
}>()

const searchQuery = defineModel<string>('searchQuery')
const sortSelected = defineModel<string>('sortSelected')
const ownershipSelected = defineModel<OwnershipOption>('ownershipSelected', {
  default: 'all'
})
const baseModelSelected = defineModel<Set<string>>('baseModelSelected', {
  default: () => new Set()
})

const actionButtonStyle =
  'h-8 rounded-lg bg-secondary-background transition-all duration-150'

const triggerButtonStyle = cn(
  actionButtonStyle,
  'relative w-8 hover:outline-component-node-widget-background-highlighted active:scale-95'
)

const menuOptionStyle =
  'flex h-8 w-full items-center justify-start gap-2 rounded-sm p-2 text-left text-sm font-normal'

const filterOptionStyle = cn('flex h-6 items-center justify-between text-left')

const isSettingsOpen = ref(false)
const isOwnershipOpen = ref(false)
const isBaseModelOpen = ref(false)

function handleSortSelected(item: SortOption) {
  sortSelected.value = item.id
  isSettingsOpen.value = false
}

function handleOwnershipSelected(item: OwnershipFilterOption) {
  ownershipSelected.value = item.value
  isOwnershipOpen.value = false
}

function toggleBaseModelSelection(item: FilterOption) {
  const current = new Set(baseModelSelected.value)
  baseModelSelected.value = current.has(item.value)
    ? new Set([...current].filter((v) => v !== item.value))
    : new Set([...current, item.value])
}

function handleSearchEnter() {
  emit('search-enter')
}
</script>

<template>
  <div class="text-secondary flex gap-2 px-4">
    <AsyncSearchInput
      v-model="searchQuery"
      autofocus
      :class="actionButtonStyle"
      @enter="handleSearchEnter"
    />
    <span
      v-if="candidateLabel"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    >
      {{ t('widgets.uploadSelect.topResult', { result: candidateLabel }) }}
    </span>

    <FormDropdownActionPopover v-model:open="isSettingsOpen">
      <template #trigger="{ toggle }">
        <Button
          :aria-label="t('g.settings')"
          :title="t('g.settings')"
          variant="textonly"
          size="icon"
          :class="triggerButtonStyle"
          @click="toggle"
        >
          <div
            v-if="sortSelected !== sortOptions[0]?.id"
            class="absolute top-[-2px] left-[-2px] size-2 rounded-full bg-component-node-widget-background-highlighted"
          />
          <i class="icon-[lucide--settings-2] size-4" />
        </Button>
      </template>
      <div
        :class="
          cn(
            'flex w-56 flex-col gap-1 px-2 py-3',
            'bg-base-background',
            'rounded-lg shadow-lg outline -outline-offset-1 outline-border-default'
          )
        "
      >
        <Button
          v-for="item of sortOptions"
          :key="item.name"
          variant="textonly"
          size="unset"
          :class="menuOptionStyle"
          @click="handleSortSelected(item)"
        >
          <span class="flex-1 truncate">{{ item.name }}</span>
          <i
            v-if="sortSelected === item.id"
            class="icon-[lucide--check] size-4 shrink-0"
          />
        </Button>
      </div>
    </FormDropdownActionPopover>

    <FormDropdownActionPopover
      v-if="showOwnershipFilter && ownershipOptions?.length"
      v-model:open="isOwnershipOpen"
    >
      <template #trigger="{ toggle }">
        <Button
          :aria-label="t('assetBrowser.ownership')"
          :title="t('assetBrowser.ownership')"
          variant="textonly"
          size="icon"
          :class="triggerButtonStyle"
          @click="toggle"
        >
          <div
            v-if="ownershipSelected !== 'all'"
            class="absolute top-[-2px] left-[-2px] size-2 rounded-full bg-component-node-widget-background-highlighted"
          />
          <i class="icon-[lucide--user] size-4" />
        </Button>
      </template>
      <div
        :class="
          cn(
            'flex min-w-32 flex-col gap-2 p-2',
            'bg-component-node-background',
            'rounded-lg shadow-lg outline -outline-offset-1 outline-component-node-border'
          )
        "
      >
        <Button
          v-for="item of ownershipOptions"
          :key="item.value"
          variant="textonly"
          size="unset"
          :class="filterOptionStyle"
          @click="handleOwnershipSelected(item)"
        >
          <span>{{ item.name }}</span>
          <i
            v-if="ownershipSelected === item.value"
            class="icon-[lucide--check] size-4"
          />
        </Button>
      </div>
    </FormDropdownActionPopover>

    <FormDropdownActionPopover
      v-if="showBaseModelFilter && baseModelOptions?.length"
      v-model:open="isBaseModelOpen"
    >
      <template #trigger="{ toggle }">
        <Button
          :aria-label="t('assetBrowser.baseModel')"
          :title="t('assetBrowser.baseModel')"
          variant="textonly"
          size="icon"
          :class="triggerButtonStyle"
          @click="toggle"
        >
          <div
            v-if="baseModelSelected.size > 0"
            class="absolute top-[-2px] left-[-2px] size-2 rounded-full bg-component-node-widget-background-highlighted"
          />
          <i class="icon-[comfy--ai-model] size-4" />
        </Button>
      </template>
      <div
        :class="
          cn(
            'flex min-w-32 flex-col gap-2 p-2',
            'bg-component-node-background',
            'rounded-lg shadow-lg outline -outline-offset-1 outline-component-node-border'
          )
        "
      >
        <div
          class="flex max-h-64 scrollbar-thin flex-col gap-2 overflow-y-auto"
        >
          <Button
            v-for="item of baseModelOptions"
            :key="item.value"
            variant="textonly"
            size="unset"
            :class="filterOptionStyle"
            @click="toggleBaseModelSelection(item)"
          >
            <span>{{ item.name }}</span>
            <i
              v-if="baseModelSelected.has(item.value)"
              class="icon-[lucide--check] size-4"
            />
          </Button>
        </div>
        <span class="h-0 w-full border-b border-border-default" />
        <Button
          variant="textonly"
          size="unset"
          :class="filterOptionStyle"
          @click="baseModelSelected = new Set()"
        >
          {{ t('g.clearFilters') }}
        </Button>
      </div>
    </FormDropdownActionPopover>
  </div>
</template>
