<script setup lang="ts">
import { ref } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const actionButtonStyle =
  'h-8 bg-zinc-800 rounded-lg outline outline-1 outline-offset-[-1px] outline-neutral-700'
const filterButtonStyle =
  'px-4 py-2 rounded-md inline-flex justify-center items-center'

const selectedIndex = ref(0)
</script>

<template>
  <!-- TODO: remove this ⬇️ -->
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div
    class="w-103 h-[640px] pt-4 bg-neutral-900 rounded-lg outline outline-offset-[-1px] outline-zinc-800 flex flex-col"
  >
    <!-- Filter -->
    <div class="flex gap-1 text-zinc-400 px-4 mb-4">
      <div :class="cn(filterButtonStyle, 'bg-zinc-800')">Inputs</div>
      <div :class="cn(filterButtonStyle, 'bg-transparent')">Outputs</div>
    </div>
    <!-- Actions -->
    <div class="flex gap-2 text-zinc-400 px-4">
      <div :class="cn(actionButtonStyle, 'flex-1 flex px-2 items-center')">
        <span class="mr-2">▼</span><span> Search </span>
      </div>
      <div
        :class="cn(actionButtonStyle, 'w-8 flex justify-center items-center')"
      >
        S
      </div>
      <div
        :class="cn(actionButtonStyle, 'w-8 flex justify-center items-center')"
      >
        V
      </div>
    </div>
    <!-- List -->
    <div class="flex overflow-hidden relative">
      <div
        class="absolute top-0 inset-x-0 h-5 bg-gradient-to-b from-neutral-900 to-transparent pointer-events-none z-10"
      />
      <div
        class="h-full max-h-full grid grid-cols-4 gap-x-2 gap-y-4 overflow-y-auto px-4 pt-4 pb-4"
      >
        <!-- Item -->
        <div
          v-for="i in 4 * 10"
          :key="i"
          class="flex flex-col gap-1 text-center select-none group/item cursor-pointer"
          @click="selectedIndex = i"
        >
          <!-- Image -->
          <div
            :class="
              cn(
                'relative',
                'aspect-square w-full overflow-hidden rounded-sm outline-1 outline-offset-[-1px] outline-zinc-300/10',
                'transition-all duration-150',
                'group-hover/item:scale-108',
                'group-active/item:scale-95',
                // selection
                !!(i === selectedIndex) && 'ring-2 ring-blue-500'
              )
            "
          >
            <div
              v-if="i === selectedIndex"
              class="rounded-full bg-blue-500 border-1 border-white size-4 absolute top-1 left-1"
            />
            <img
              :src="`https://picsum.photos/120/100?random=${i}`"
              class="size-full object-cover"
            />
          </div>
          <!-- Name -->
          <span
            :class="
              cn(
                'block text-[15px] line-clamp-2 wrap-break-word',
                'transition-colors duration-150',
                // selection
                !!(i === selectedIndex) && 'text-blue-500'
              )
            "
          >
            ImageName.png
          </span>
          <!-- Meta Data -->
          <span class="block text-xs text-slate-400">1024 x 1024</span>
        </div>
      </div>
    </div>
  </div>
</template>
