<script setup lang="ts">
import type { Component } from 'vue'
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

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
  <TabsRoot v-model="selection" :aria-label="label">
    <div class="flex min-w-0 overflow-x-auto">
      <TabsList
        class="border-transparency-white-t15 bg-transparency-white-t8 rounded-hub-filter inline-flex items-center gap-1 border p-1"
      >
        <TabsTrigger
          v-for="item in items"
          :key="item.value"
          :value="item.value"
          :aria-label="item.label"
          class="text-content-secondary hover:bg-transparency-white-t8 hover:text-content data-[state=active]:bg-brand data-[state=active]:text-page data-[state=active]:hover:bg-brand focus-visible:ring-brand focus-visible:ring-offset-page rounded-hub-filter-item group inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 px-2.5 text-xs font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-1 sm:px-3.5"
        >
          <component
            :is="item.icon"
            v-if="item.icon"
            class="size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span
            class="ppformula-text-center-sm max-sm:hidden max-sm:group-data-[state=active]:inline-block"
          >
            {{ item.label }}
          </span>
        </TabsTrigger>
      </TabsList>
    </div>
  </TabsRoot>
</template>
