<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

import { WidgetInputBaseClass } from '../../layout'
</script>

<template>
  <!-- TODO: remove this ⬇️ -->
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div
    :class="
      cn(
        WidgetInputBaseClass,
        'flex text-base leading-none text-zinc-400 hover:text-inherit'
      )
    "
  >
    <!-- Dropdown -->
    <div class="flex justify-between items-center flex-1 h-8">
      <span class="px-4 py-2">Select Image</span>
      <span class="p-2">▼</span>
    </div>
    <!-- Open File -->
    <div
      class="size-8 flex justify-center items-center border-l border-zinc-300/10"
    >
      <span>F</span>
    </div>
  </div>
</template>
