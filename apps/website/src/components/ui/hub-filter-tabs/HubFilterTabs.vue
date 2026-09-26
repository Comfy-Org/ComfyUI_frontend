<script setup lang="ts">
import type { Component } from 'vue'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'

export interface HubFilterTab {
  icon?: Component
  label: string
  value: string
}

const { items, label } = defineProps<{
  items: HubFilterTab[]
  label: string
}>()

const selection = defineModel<string>({ required: true })
</script>

<template>
  <RadioGroupRoot
    v-model="selection"
    :aria-label="label"
    orientation="horizontal"
  >
    <div class="flex min-w-0 overflow-x-auto">
      <div
        class="border-transparency-white-t15 rounded-hub-filter inline-flex items-center gap-1 border bg-transparency-white-t8 p-1"
      >
        <RadioGroupItem
          v-for="item in items"
          :key="item.value"
          :value="item.value"
          :aria-label="item.label"
          class="text-content-secondary hover:text-content data-[state=checked]:bg-brand data-[state=checked]:text-page data-[state=checked]:hover:bg-brand focus-visible:ring-brand focus-visible:ring-offset-page rounded-hub-filter-item group inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 px-2.5 text-xs font-semibold whitespace-nowrap transition-colors outline-none hover:bg-transparency-white-t8 focus-visible:ring-2 focus-visible:ring-offset-1 sm:px-3.5"
        >
          <component
            :is="item.icon"
            v-if="item.icon"
            class="size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span
            class="ppformula-text-center-sm max-sm:hidden max-sm:group-data-[state=checked]:inline-block"
          >
            {{ item.label }}
          </span>
        </RadioGroupItem>
      </div>
    </div>
  </RadioGroupRoot>
</template>
