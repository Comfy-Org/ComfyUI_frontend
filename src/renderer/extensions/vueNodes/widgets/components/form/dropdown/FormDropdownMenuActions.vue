<script setup lang="ts">
import type { MaybeRefOrGetter } from 'vue'

import Popover from 'primevue/popover'
import { ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  OptionId,
  OwnershipFilterOption,
  OwnershipOption
} from '@/platform/assets/types/filterTypes'
import { cn } from '@/utils/tailwindUtil'

import FormSearchInput from '../FormSearchInput.vue'
import type { LayoutMode, SortOption } from './types'

const { t } = useI18n()

defineProps<{
  searcher?: (
    query: string,
    onCleanup: (cleanupFn: () => void) => void
  ) => Promise<void>
  sortOptions: SortOption[]
  updateKey?: MaybeRefOrGetter<unknown>
  showOwnershipFilter?: boolean
  ownershipOptions?: OwnershipFilterOption[]
}>()

const layoutMode = defineModel<LayoutMode>('layoutMode')
const searchQuery = defineModel<string>('searchQuery')
const sortSelected = defineModel<OptionId>('sortSelected')
const ownershipSelected = defineModel<OwnershipOption>('ownershipSelected', {
  default: 'all'
})

const actionButtonStyle = cn(
  'h-8 bg-zinc-500/20 rounded-lg outline outline-1 outline-offset-[-1px] outline-node-component-border transition-all duration-150'
)

const resetInputStyle = 'bg-transparent border-0 outline-0 ring-0 text-left'

const layoutSwitchItemStyle =
  'size-6 flex justify-center items-center rounded-sm cursor-pointer transition-all duration-150 hover:scale-108 hover:text-base-foreground active:scale-95'

const sortPopoverRef = useTemplateRef('sortPopoverRef')
const sortTriggerRef = useTemplateRef('sortTriggerRef')
const isSortPopoverOpen = ref(false)

function toggleSortPopover(event: Event) {
  if (!sortPopoverRef.value || !sortTriggerRef.value) return
  isSortPopoverOpen.value = !isSortPopoverOpen.value
  sortPopoverRef.value.toggle(event, sortTriggerRef.value)
}
function closeSortPopover() {
  isSortPopoverOpen.value = false
  sortPopoverRef.value?.hide()
}

function handleSortSelected(item: SortOption) {
  sortSelected.value = item.id
  closeSortPopover()
}

const ownershipPopoverRef = useTemplateRef('ownershipPopoverRef')
const ownershipTriggerRef = useTemplateRef('ownershipTriggerRef')
const isOwnershipPopoverOpen = ref(false)

function toggleOwnershipPopover(event: Event) {
  if (!ownershipPopoverRef.value || !ownershipTriggerRef.value) return
  isOwnershipPopoverOpen.value = !isOwnershipPopoverOpen.value
  ownershipPopoverRef.value.toggle(event, ownershipTriggerRef.value)
}
function closeOwnershipPopover() {
  isOwnershipPopoverOpen.value = false
  ownershipPopoverRef.value?.hide()
}

function handleOwnershipSelected(item: OwnershipFilterOption) {
  ownershipSelected.value = item.id
  closeOwnershipPopover()
}
</script>

<template>
  <div class="text-secondary flex gap-2 px-4">
    <FormSearchInput
      v-model="searchQuery"
      :searcher
      :update-key="updateKey"
      :class="
        cn(
          actionButtonStyle,
          'hover:outline-component-node-widget-background-highlighted/80',
          'focus-within:outline-component-node-widget-background-highlighted/80 focus-within:ring-0'
        )
      "
    />

    <button
      ref="sortTriggerRef"
      :class="
        cn(
          resetInputStyle,
          actionButtonStyle,
          'relative w-8 flex justify-center items-center cursor-pointer',
          'hover:outline-component-node-widget-background-highlighted',
          'active:!scale-95'
        )
      "
      @click="toggleSortPopover"
    >
      <div
        v-if="sortSelected !== 'default'"
        class="absolute top-[-2px] left-[-2px] size-2 rounded-full bg-component-node-widget-background-highlighted"
      />
      <i class="icon-[lucide--arrow-up-down] size-4" />
    </button>
    <Popover
      ref="sortPopoverRef"
      :dismissable="true"
      :close-on-escape="true"
      unstyled
      :pt="{
        root: {
          class: 'absolute z-50'
        },
        content: {
          class: ['bg-transparent border-none p-0 pt-2 rounded-lg shadow-lg']
        }
      }"
      @hide="isSortPopoverOpen = false"
    >
      <div
        :class="
          cn(
            'flex flex-col gap-2 p-2 min-w-32',
            'bg-component-node-background',
            'rounded-lg outline outline-offset-[-1px] outline-component-node-border'
          )
        "
      >
        <button
          v-for="item of sortOptions"
          :key="item.name"
          :class="
            cn(
              resetInputStyle,
              'flex justify-between items-center h-6 cursor-pointer',
              'hover:!text-blue-500'
            )
          "
          @click="handleSortSelected(item)"
        >
          <span>{{ item.name }}</span>
          <i
            v-if="sortSelected === item.id"
            class="icon-[lucide--check] size-4"
          />
        </button>
      </div>
    </Popover>

    <button
      v-if="showOwnershipFilter && ownershipOptions?.length"
      ref="ownershipTriggerRef"
      :title="t('assetBrowser.ownership')"
      :class="
        cn(
          resetInputStyle,
          actionButtonStyle,
          'relative w-8 flex justify-center items-center cursor-pointer',
          'hover:outline-component-node-widget-background-highlighted',
          'active:!scale-95'
        )
      "
      @click="toggleOwnershipPopover"
    >
      <div
        v-if="ownershipSelected !== 'all'"
        class="absolute top-[-2px] left-[-2px] size-2 rounded-full bg-component-node-widget-background-highlighted"
      />
      <i class="icon-[lucide--user] size-4" />
    </button>
    <Popover
      ref="ownershipPopoverRef"
      :dismissable="true"
      :close-on-escape="true"
      unstyled
      :pt="{
        root: {
          class: 'absolute z-50'
        },
        content: {
          class: ['bg-transparent border-none p-0 pt-2 rounded-lg shadow-lg']
        }
      }"
      @hide="isOwnershipPopoverOpen = false"
    >
      <div
        :class="
          cn(
            'flex flex-col gap-2 p-2 min-w-32',
            'bg-component-node-background',
            'rounded-lg outline outline-offset-[-1px] outline-component-node-border'
          )
        "
      >
        <button
          v-for="item of ownershipOptions"
          :key="item.id"
          :class="
            cn(
              resetInputStyle,
              'flex justify-between items-center h-6 cursor-pointer',
              'hover:!text-blue-500'
            )
          "
          @click="handleOwnershipSelected(item)"
        >
          <span>{{ item.name }}</span>
          <i
            v-if="ownershipSelected === item.id"
            class="icon-[lucide--check] size-4"
          />
        </button>
      </div>
    </Popover>

    <div
      :class="
        cn(
          actionButtonStyle,
          'flex justify-center items-center p-1 gap-1 hover:outline-component-node-widget-background-highlighted'
        )
      "
    >
      <button
        :class="
          cn(
            resetInputStyle,
            layoutSwitchItemStyle,
            layoutMode === 'list'
              ? 'bg-neutral-500/50 text-base-foreground'
              : ''
          )
        "
        @click="layoutMode = 'list'"
      >
        <i class="icon-[lucide--list] size-4" />
      </button>
      <button
        :class="
          cn(
            resetInputStyle,
            layoutSwitchItemStyle,
            layoutMode === 'grid'
              ? 'bg-neutral-500/50 text-base-foreground'
              : ''
          )
        "
        @click="layoutMode = 'grid'"
      >
        <i class="icon-[lucide--layout-grid] size-4" />
      </button>
    </div>
  </div>
</template>
