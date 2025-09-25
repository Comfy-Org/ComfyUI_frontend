<script setup lang="ts">
import Popover from 'primevue/popover'
import { ref, useTemplateRef } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import type { LayoutMode, SortOption, SortOptionLabel } from './types'

defineProps<{
  isQuerying: boolean
}>()

const layoutMode = defineModel<LayoutMode>('layoutMode')
const searchQuery = defineModel<string>('searchQuery')

const actionButtonStyle =
  'h-8 bg-zinc-500/20 rounded-lg outline outline-1 outline-offset-[-1px] outline-sand-100 dark-theme:outline-neutral-700 transition-all duration-150'

const resetInputStyle = 'bg-transparent border-0 outline-0 ring-0 text-left'

const layoutSwitchItemStyle =
  'size-6 flex justify-center items-center rounded-sm cursor-pointer transition-all duration-150 hover:scale-108 hover:text-black hover:dark-theme:text-white active:scale-95'

const sortPopoverRef = useTemplateRef('sortPopoverRef')
const sortTriggerRef = useTemplateRef('sortTriggerRef')
const isSortPopoverOpen = ref(false)

function toggleSortPopover(event: Event) {
  if (!sortPopoverRef.value || !sortTriggerRef.value) return
  isSortPopoverOpen.value = !isSortPopoverOpen.value
  sortPopoverRef.value.toggle(event, sortTriggerRef.value)
}
// TODO Sorting function, How to get the time info of the items needed for sorting?
const sortOptions = ref<SortOption[]>([
  {
    name: 'Default',
    value: 'default'
  },
  {
    name: 'A-Z',
    value: 'a-z'
  }
])
const sortSelected = defineModel<SortOptionLabel>('sortSelected')
</script>

<template>
  <!-- TODO: remove this ⬇️ -->
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div class="flex gap-2 text-zinc-400 px-4">
    <label
      :class="
        cn(
          actionButtonStyle,
          'flex-1 flex px-2 items-center text-base leading-none cursor-text',
          searchQuery?.trim() !== '' ? 'text-black dark-theme:text-white' : '',
          'hover:!outline-blue-500/80',
          'focus-within:!outline-blue-500/80'
        )
      "
    >
      <i-lucide:loader-circle
        v-if="isQuerying"
        class="mr-2 size-4 animate-spin"
      />
      <i-lucide:search v-else class="mr-2 size-4" />
      <input
        v-model="searchQuery"
        type="text"
        :class="resetInputStyle"
        placeholder="Search"
      />
    </label>

    <!-- Sort Select -->
    <button
      ref="sortTriggerRef"
      :class="
        cn(
          resetInputStyle,
          actionButtonStyle,
          'w-8 flex justify-center items-center cursor-pointer',
          'hover:!outline-blue-500/80',
          'active:!scale-95'
        )
      "
      @click="toggleSortPopover"
    >
      <i-lucide:arrow-up-down class="size-4" />
    </button>
    <!-- Sort Popover -->
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
            'bg-zinc-200 dark-theme:bg-charcoal-700',
            'rounded-lg outline outline-offset-[-1px] outline-sand-200 dark-theme:outline-zinc-700'
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
          @click="sortSelected = item.value"
        >
          <span>{{ item.name }}</span>
          <i-lucide:check v-if="sortSelected === item.value" class="size-4" />
        </button>
      </div>
    </Popover>

    <!-- Layout Switch -->
    <div
      :class="
        cn(
          actionButtonStyle,
          'flex justify-center items-center p-1 gap-1 hover:!outline-blue-500/80'
        )
      "
    >
      <button
        :class="
          cn(
            resetInputStyle,
            layoutSwitchItemStyle,
            layoutMode === 'list'
              ? 'bg-neutral-500/50 text-black dark-theme:text-white'
              : ''
          )
        "
        @click="layoutMode = 'list'"
      >
        <i-lucide:list class="size-4" />
      </button>
      <button
        :class="
          cn(
            resetInputStyle,
            layoutSwitchItemStyle,
            layoutMode === 'grid'
              ? 'bg-neutral-500/50 text-black dark-theme:text-white'
              : ''
          )
        "
        @click="layoutMode = 'grid'"
      >
        <i-lucide:layout-grid class="size-4" />
      </button>
    </div>
  </div>
</template>
