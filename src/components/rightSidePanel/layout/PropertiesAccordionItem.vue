<script lang="ts" setup>
import { watch } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const { label, defaultCollapse } = defineProps<{
  label?: string
  defaultCollapse?: boolean
}>()
const isCollapse = defineModel<boolean>('collapse', { default: false })

if (defaultCollapse) {
  isCollapse.value = true
}
watch(
  () => defaultCollapse,
  (value) => (isCollapse.value = value)
)
</script>

<template>
  <div class="flex flex-col">
    <div
      class="sticky top-0 z-10 flex items-center justify-between backdrop-blur-xl"
    >
      <button
        class="group min-h-12 bg-transparent border-0 outline-0 ring-0 w-full text-left flex items-center justify-between pl-4 pr-3 cursor-pointer"
        @click="isCollapse = !isCollapse"
      >
        <span class="text-sm font-semibold line-clamp-2">
          <slot name="label">
            {{ label ?? '' }}
          </slot>
        </span>

        <i
          :class="
            cn(
              'icon-[lucide--chevron-up] size-4 transition-all',
              isCollapse && '-rotate-180'
            )
          "
          class="text-muted-foreground group-hover:text-base-foreground group-focus:text-base-foreground"
        />
      </button>
    </div>
    <div v-if="!isCollapse" class="pb-4">
      <slot />
    </div>
  </div>
</template>
