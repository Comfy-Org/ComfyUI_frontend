<template>
  <div class="flex flex-col h-full w-full bg-white dark-theme:bg-zinc-800">
    <PanelHeader>
      <template #icon>
        <slot name="header-icon"></slot>
      </template>
      <slot name="header-title"></slot>
    </PanelHeader>

    <nav class="flex-1 px-3 py-4 flex flex-col gap-1">
      <template v-for="(item, index) in navItems" :key="index">
        <div v-if="'items' in item" class="flex flex-col gap-2">
          <NavTitle :title="item.title" />
          <NavItem
            v-for="subItem in item.items"
            :key="subItem.id"
            :active="activeItem === subItem.id"
            @click="activeItem = subItem.id"
          >
            {{ subItem.label }}
          </NavItem>
        </div>
        <div v-else class="flex flex-col gap-2">
          <NavItem
            :active="activeItem === item.id"
            @click="activeItem = item.id"
          >
            {{ item.label }}
          </NavItem>
        </div>
      </template>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import NavItem from '@/components/widget/nav/NavItem.vue'
import NavTitle from '@/components/widget/nav/NavTitle.vue'
import { NavGroupData, NavItemData } from '@/types/navTypes'

import PanelHeader from './PanelHeader.vue'

const { navItems = [], modelValue } = defineProps<{
  navItems?: (NavItemData | NavGroupData)[]
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const getFirstItemId = () => {
  if (!navItems || navItems.length === 0) {
    return null
  }

  const firstEntry = navItems[0]

  if ('items' in firstEntry && firstEntry.items.length > 0) {
    return firstEntry.items[0].id
  }
  if ('id' in firstEntry) {
    return firstEntry.id
  }

  return null
}

const activeItem = computed({
  get: () => modelValue ?? getFirstItemId(),
  set: (value: string | null) => emit('update:modelValue', value)
})
</script>
