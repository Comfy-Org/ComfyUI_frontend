<script setup lang="ts">
import Badge from '@/components/common/Badge.vue'
import { NavigationMenuLink } from '@/components/ui/navigation-menu'

import type { NavColumn } from '../../../data/mainNavigation'

defineProps<{ column: NavColumn }>()
</script>

<template>
  <li class="flex flex-col space-y-4">
    <p class="font-formula text-primary-warm-gray pl-2 text-sm font-medium">
      {{ column.header }}
    </p>
    <ul class="flex flex-col">
      <li v-for="item in column.items" :key="item.label">
        <NavigationMenuLink as-child class="hover:bg-transparency-white-t4">
          <a
            :href="item.href"
            class="flex flex-row items-center gap-2 whitespace-nowrap"
          >
            <span>{{ item.label }}</span>
            <Badge v-if="item.badge" size="xs" variant="accent">
              {{ item.badge }}
            </Badge>
          </a>
        </NavigationMenuLink>
      </li>
    </ul>
  </li>
</template>
