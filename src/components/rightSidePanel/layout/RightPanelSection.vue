<script lang="ts" setup>
import { watch } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  label?: string
  defaultCollapse?: boolean
}>()
const isCollapse = defineModel<boolean>('collapse', { default: false })

if (props.defaultCollapse) {
  isCollapse.value = true
}
watch(
  () => props.defaultCollapse,
  (value) => (isCollapse.value = value)
)
</script>

<template>
  <div class="flex flex-col">
    <div
      class="sticky top-0 z-10 flex items-center justify-between backdrop-blur-xl min-h-12"
    >
      <button
        class="group min-h-12 bg-transparent border-0 outline-0 ring-0 w-full text-left flex items-center justify-between pl-4 pr-3 cursor-pointer"
        @click="isCollapse = !isCollapse"
      >
        <span class="text-sm font-semibold line-clamp-2">
          <slot name="label">
            {{ props.label ?? '' }}
          </slot>
        </span>

        <i
          :class="
            cn(
              'icon-[lucide--chevron-down] size-5 min-w-5 transition-all',
              isCollapse && 'rotate-90'
            )
          "
          class="relative top-px text-xs leading-none text-node-component-header-icon group-hover:text-base-foreground"
        />
      </button>
    </div>
    <div v-if="!isCollapse" class="pb-4">
      <slot />
    </div>
  </div>
</template>
