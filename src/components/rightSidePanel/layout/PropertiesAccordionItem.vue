<script lang="ts" setup>
import { watch } from 'vue'

import { cn } from '@/utils/tailwindUtil'

const props = defineProps<{
  isEmpty?: boolean
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
  <div class="flex flex-col bg-interface-panel-surface">
    <div
      class="sticky top-0 z-10 flex items-center justify-between backdrop-blur-xl bg-inherit"
    >
      <button
        v-tooltip="
          isEmpty
            ? {
                value: $t('rightSidePanel.inputsNoneTooltip'),
                showDelay: 1_000
              }
            : undefined
        "
        type="button"
        :class="
          cn(
            'group min-h-12 bg-transparent border-0 outline-0 ring-0 w-full text-left flex items-center justify-between pl-4 pr-3',
            !isEmpty && 'cursor-pointer'
          )
        "
        :disabled="isEmpty"
        @click="isCollapse = !isCollapse"
      >
        <span class="text-sm font-semibold line-clamp-2 flex-1">
          <slot name="label" />
        </span>

        <i
          v-if="!isEmpty"
          :class="
            cn(
              'text-muted-foreground group-hover:text-base-foreground group-focus:text-base-foreground icon-[lucide--chevron-up] size-4 transition-all',
              isCollapse && '-rotate-180'
            )
          "
        />
      </button>
    </div>
    <div v-if="!isCollapse && !isEmpty" class="pb-4">
      <slot />
    </div>
  </div>
</template>
