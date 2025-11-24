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
      class="sticky top-0 z-10 flex items-center justify-between backdrop-blur-xl"
    >
      <button
        class="bg-transparent border-0 outline-0 ring-0 w-full text-left flex items-center justify-between pl-4 pr-3"
        @click="isCollapse = !isCollapse"
      >
        <span class="block my-3.5 text-sm font-semibold">
          <slot name="label">
            {{ props.label ?? '' }}
          </slot>
        </span>

        <i
          :class="
            cn(
              'icon-[lucide--chevron-down] size-5 transition-transform',
              isCollapse && 'rotate-90'
            )
          "
          class="relative top-px text-xs leading-none text-node-component-header-icon"
        />
      </button>
    </div>
    <div v-if="!isCollapse">
      <slot />
    </div>
  </div>
</template>
