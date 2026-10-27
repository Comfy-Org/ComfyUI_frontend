<script setup lang="ts">
import { unrefElement } from '@vueuse/core'
import { PopoverRoot, PopoverTrigger } from 'reka-ui'
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import PopoverContent from '@comfyorg/design-system/popover/PopoverContent'
import { usePopoverViewportDismiss } from '@comfyorg/design-system/lib/popover/usePopoverViewportDismiss'
import type {
  FilterOption,
  OwnershipFilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'
import { cn } from '@comfyorg/tailwind-utils'

import AsyncSearchInput from '@comfyorg/design-system/search-input/AsyncSearchInput'
import { DROPDOWN_PANEL_CLASS } from './shared'
import type { LayoutMode, SortOption } from './types'

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

const layoutMode = defineModel<LayoutMode>('layoutMode')
const searchQuery = defineModel<string>('searchQuery')
const sortSelected = defineModel<string>('sortSelected')
const ownershipSelected = defineModel<OwnershipOption>('ownershipSelected', {
  default: 'all'
})
const baseModelSelected = defineModel<Set<string>>('baseModelSelected', {
  default: () => new Set()
})

const actionButtonStyle = cn(
  'h-8 rounded-lg bg-zinc-500/20 outline-1 -outline-offset-1 outline-node-border transition-all duration-150'
)

const actionPopoverClass = cn(
  DROPDOWN_PANEL_CLASS,
  'pointer-events-auto max-h-(--reka-popover-content-available-height) w-auto max-w-(--reka-popover-content-available-width) overflow-auto rounded-lg border-none bg-transparent p-0 pt-2 shadow-lg data-[state=closed]:animate-none data-[state=open]:animate-none'
)

const layoutSwitchItemStyle =
  'size-6 flex justify-center items-center rounded-sm cursor-pointer transition-all duration-150 hover:scale-108 hover:text-foreground active:scale-95'

const sortTriggerRef = useTemplateRef('sortTriggerRef')
const isSortPopoverOpen = ref(false)

function closeSortPopover() {
  isSortPopoverOpen.value = false
}

function handleSortSelected(item: SortOption) {
  sortSelected.value = item.id
  closeSortPopover()
}

const ownershipTriggerRef = useTemplateRef('ownershipTriggerRef')
const isOwnershipPopoverOpen = ref(false)

function closeOwnershipPopover() {
  isOwnershipPopoverOpen.value = false
}

function handleOwnershipSelected(item: OwnershipFilterOption) {
  ownershipSelected.value = item.value
  closeOwnershipPopover()
}

const baseModelTriggerRef = useTemplateRef('baseModelTriggerRef')
const isBaseModelPopoverOpen = ref(false)

usePopoverViewportDismiss(isSortPopoverOpen, () => unrefElement(sortTriggerRef))
usePopoverViewportDismiss(isOwnershipPopoverOpen, () =>
  unrefElement(ownershipTriggerRef)
)
usePopoverViewportDismiss(isBaseModelPopoverOpen, () =>
  unrefElement(baseModelTriggerRef)
)

function toggleBaseModelSelection(item: FilterOption) {
  const current = new Set(baseModelSelected.value)
  baseModelSelected.value = current.has(item.value)
    ? new Set([...current].filter((v) => v !== item.value))
    : new Set([...current, item.value])
}

function handleSearchEnter(event: KeyboardEvent) {
  event.preventDefault()
  emit('search-enter')
}
</script>

<template>
  <div class="flex gap-2 px-4 text-muted-foreground">
    <AsyncSearchInput
      v-model="searchQuery"
      :clear-label="$t('g.clear')"
      :placeholder="$t('g.searchPlaceholder', { subject: '' })"
      :accessible-label="$t('g.search')"
      autofocus
      :class="
        cn(
          actionButtonStyle,
          'hover:outline-muted-foreground/80',
          'focus-within:ring-0 focus-within:outline-ring/80'
        )
      "
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

    <PopoverRoot v-model:open="isSortPopoverOpen">
      <PopoverTrigger as-child>
        <Button
          ref="sortTriggerRef"
          :aria-label="t('assetBrowser.sortBy')"
          :title="t('assetBrowser.sortBy')"
          variant="textonly"
          size="icon"
          :class="
            cn(
              actionButtonStyle,
              'relative w-8 hover:outline-muted-foreground active:scale-95'
            )
          "
        >
          <div
            v-if="sortSelected !== 'default'"
            class="absolute top-[-2px] left-[-2px] size-2 rounded-full bg-muted-foreground"
          />
          <i class="icon-[lucide--arrow-up-down]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" :class="actionPopoverClass">
        <div
          :class="
            cn(
              'flex min-w-32 flex-col gap-2 p-2',
              'bg-node',
              'rounded-lg outline -outline-offset-1 outline-node-border'
            )
          "
        >
          <Button
            v-for="item of sortOptions"
            :key="item.name"
            variant="textonly"
            size="unset"
            :class="cn('flex h-6 items-center justify-between text-left')"
            @click="handleSortSelected(item)"
          >
            <span>{{ item.name }}</span>
            <i v-if="sortSelected === item.id" class="icon-[lucide--check]" />
          </Button>
        </div>
      </PopoverContent>
    </PopoverRoot>

    <PopoverRoot
      v-if="showOwnershipFilter && ownershipOptions?.length"
      v-model:open="isOwnershipPopoverOpen"
    >
      <PopoverTrigger as-child>
        <Button
          ref="ownershipTriggerRef"
          :aria-label="t('assetBrowser.ownership')"
          :title="t('assetBrowser.ownership')"
          variant="textonly"
          size="icon"
          :class="
            cn(
              actionButtonStyle,
              'relative w-8 hover:outline-muted-foreground active:scale-95'
            )
          "
        >
          <div
            v-if="ownershipSelected !== 'all'"
            class="absolute top-[-2px] left-[-2px] size-2 rounded-full bg-muted-foreground"
          />
          <i class="icon-[lucide--user]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" :class="actionPopoverClass">
        <div
          :class="
            cn(
              'flex min-w-32 flex-col gap-2 p-2',
              'bg-node',
              'rounded-lg outline -outline-offset-1 outline-node-border'
            )
          "
        >
          <Button
            v-for="item of ownershipOptions"
            :key="item.value"
            variant="textonly"
            size="unset"
            :class="cn('flex h-6 items-center justify-between text-left')"
            @click="handleOwnershipSelected(item)"
          >
            <span>{{ item.name }}</span>
            <i
              v-if="ownershipSelected === item.value"
              class="icon-[lucide--check]"
            />
          </Button>
        </div>
      </PopoverContent>
    </PopoverRoot>

    <PopoverRoot
      v-if="showBaseModelFilter && baseModelOptions?.length"
      v-model:open="isBaseModelPopoverOpen"
    >
      <PopoverTrigger as-child>
        <Button
          ref="baseModelTriggerRef"
          :aria-label="t('assetBrowser.baseModel')"
          :title="t('assetBrowser.baseModel')"
          variant="textonly"
          size="icon"
          :class="
            cn(
              actionButtonStyle,
              'relative w-8 hover:outline-muted-foreground active:scale-95'
            )
          "
        >
          <div
            v-if="baseModelSelected.size > 0"
            class="absolute top-[-2px] left-[-2px] size-2 rounded-full bg-muted-foreground"
          />
          <i class="icon-[comfy--ai-model]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" :class="actionPopoverClass">
        <div
          :class="
            cn(
              'flex min-w-32 flex-col gap-2 p-2',
              'bg-node',
              'rounded-lg outline -outline-offset-1 outline-node-border'
            )
          "
        >
          <Button
            v-for="item of baseModelOptions"
            :key="item.value"
            variant="textonly"
            size="unset"
            :class="cn('flex h-6 items-center justify-between text-left')"
            @click="toggleBaseModelSelection(item)"
          >
            <span>{{ item.name }}</span>
            <i
              v-if="baseModelSelected.has(item.value)"
              class="icon-[lucide--check]"
            />
          </Button>
          <span class="h-0 w-full border-b" />
          <Button
            variant="textonly"
            size="unset"
            :class="cn('flex h-6 items-center justify-between text-left')"
            @click="baseModelSelected = new Set()"
          >
            {{ t('g.clearFilters') }}
          </Button>
        </div>
      </PopoverContent>
    </PopoverRoot>

    <div
      :class="
        cn(
          actionButtonStyle,
          'flex items-center justify-center gap-1 p-1 hover:outline-muted-foreground'
        )
      "
    >
      <Button
        :aria-label="t('assetBrowser.listView')"
        :title="t('assetBrowser.listView')"
        variant="textonly"
        size="unset"
        :class="
          cn(
            layoutSwitchItemStyle,
            layoutMode === 'list' && 'bg-muted text-foreground'
          )
        "
        @click="layoutMode = 'list'"
      >
        <i class="icon-[lucide--list]" />
      </Button>
      <Button
        :aria-label="t('assetBrowser.gridView')"
        :title="t('assetBrowser.gridView')"
        variant="textonly"
        size="unset"
        :class="
          cn(
            layoutSwitchItemStyle,
            layoutMode === 'grid' && 'bg-muted text-foreground'
          )
        "
        @click="layoutMode = 'grid'"
      >
        <i class="icon-[lucide--layout-grid]" />
      </Button>
    </div>
  </div>
</template>
