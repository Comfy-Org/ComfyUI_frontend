<script setup lang="ts">
import { cn } from '@/utils/tailwindUtil'

interface Props {
  layoutMode: 'list' | 'grid'
}

defineProps<Props>()

const emit = defineEmits<{
  'update:layoutMode': [mode: 'list' | 'grid']
}>()

const actionButtonStyle =
  'h-8 bg-zinc-500/20 rounded-lg outline outline-1 outline-offset-[-1px] outline-sand-100 dark-theme:outline-neutral-700'

const layoutSwitchItemStyle =
  'size-6 flex justify-center items-center rounded-sm cursor-pointer hover:scale-108 hover:text-black hover:dark-theme:text-white'

const handleLayoutChange = (mode: 'list' | 'grid') => {
  emit('update:layoutMode', mode)
}
</script>

<template>
  <!-- TODO: remove this ⬇️ -->
  <!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
  <div class="flex gap-2 text-zinc-400 px-4">
    <div
      :class="
        cn(
          actionButtonStyle,
          'flex-1 flex px-2 items-center text-base leading-none'
        )
      "
    >
      <i-lucide:search class="mr-2 size-4" /><span>Search</span>
    </div>
    <!-- Sort Select -->
    <div :class="cn(actionButtonStyle, 'w-8 flex justify-center items-center')">
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
        @click="handleLayoutChange('list')"
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
        @click="handleLayoutChange('grid')"
      >
        <i-lucide:layout-grid class="size-4" />
      </div>
    </div>
  </div>
</template>
