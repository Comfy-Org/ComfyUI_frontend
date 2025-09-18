<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import FormDropdownMenuItem from './FormDropdownMenuItem.vue'

const actionButtonStyle =
  'h-8 bg-zinc-500/20 rounded-lg outline outline-1 outline-offset-[-1px] outline-sand-100 dark-theme:outline-neutral-700'

const filterIndex = ref(0)
const filterButtonStyle =
  'px-4 py-2 rounded-md inline-flex justify-center items-center cursor-pointer hover:text-black hover:dark-theme:text-white'

const layoutMode = ref<'list' | 'grid'>('grid')
const layoutSwitchItemStyle =
  'size-6 flex justify-center items-center rounded-sm cursor-pointer hover:scale-108 hover:text-black hover:dark-theme:text-white'

const selectedIndex = ref(0)
</script>

<template>
  <!-- TODO: remove this ⬇️ -->
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div
    class="w-103 h-[640px] pt-4 bg-white dark-theme:bg-charcoal-800 rounded-lg outline outline-offset-[-1px] outline-sand-100 dark-theme:outline-zinc-800 flex flex-col"
  >
    <!-- Filter -->
    <div class="flex gap-1 text-zinc-400 px-4 mb-4">
      <div
        :class="
          cn(
            filterButtonStyle,
            filterIndex === 0
              ? '!bg-zinc-500/20 text-black dark-theme:text-white'
              : 'bg-transparent'
          )
        "
        @click="filterIndex = 0"
      >
        Inputs
      </div>
      <div
        :class="
          cn(
            filterButtonStyle,
            filterIndex === 1
              ? '!bg-zinc-500/20 text-black dark-theme:text-white'
              : 'bg-transparent'
          )
        "
        @click="filterIndex = 1"
      >
        Outputs
      </div>
    </div>
    <!-- Actions -->
    <div class="flex gap-2 text-zinc-400 px-4">
      <div
        :class="
          cn(
            actionButtonStyle,
            'flex-1 flex px-2 items-center text-base leading-none'
          )
        "
      >
        <i-lucide:search class="mr-2 size-4" /><span> Search </span>
      </div>
      <!-- Sort Select -->
      <div
        :class="cn(actionButtonStyle, 'w-8 flex justify-center items-center')"
      >
        <i-lucide:arrow-up-down class="size-4" />
      </div>
      <!-- Layout Switch -->
      <div
        :class="
          cn(actionButtonStyle, 'flex justify-center items-center p-1 gap-1')
        "
      >
        <div
          :class="
            cn(
              layoutSwitchItemStyle,
              layoutMode === 'list'
                ? 'bg-neutral-500/50 text-black dark-theme:text-white'
                : ''
            )
          "
          @click="layoutMode = 'list'"
        >
          <i-lucide:list class="size-4" />
        </div>
        <div
          :class="
            cn(
              layoutSwitchItemStyle,
              layoutMode === 'grid'
                ? 'bg-neutral-500/50 text-black dark-theme:text-white'
                : ''
            )
          "
          @click="layoutMode = 'grid'"
        >
          <i-lucide:layout-grid class="size-4" />
        </div>
      </div>
    </div>
    <!-- List -->
    <div class="flex overflow-hidden relative">
      <div
        class="h-full max-h-full grid grid-cols-4 gap-x-2 gap-y-4 overflow-y-auto px-4 pt-4 pb-4"
      >
        <div
          class="absolute top-0 inset-x-3 h-5 bg-gradient-to-b from-white dark-theme:from-neutral-900 to-transparent pointer-events-none z-10"
        />
        <!-- Item -->
        <FormDropdownMenuItem
          v-for="i in 4 * 10"
          :key="i"
          :index="i"
          :selected-index="selectedIndex"
          :image-src="`https://picsum.photos/120/100?random=${i}`"
          name="ImageName.png"
          metadata="1024 x 1024"
          @click="selectedIndex = $event"
        />
      </div>
    </div>
  </div>
</template>
