<script setup lang="ts">
import NavigationMenuLink from '@/components/ui/navigation-menu/NavigationMenuLink.vue'

import { isHrefActive } from '../../../composables/useCurrentPath'
import type { NavColumn } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'
import NavLinkContent from './NavLinkContent.vue'

defineProps<{ column: NavColumn; locale: Locale; currentPath: string }>()
</script>

<template>
  <li class="flex flex-col space-y-4">
    <p class="font-formula text-primary-warm-gray pl-2 text-sm font-medium">
      {{ column.header }}
    </p>
    <ul class="flex flex-col">
      <li v-for="item in column.items" :key="item.label">
        <NavigationMenuLink
          as-child
          :active="isHrefActive(item.href, currentPath)"
          class="hover:bg-transparency-white-t4"
        >
          <a
            :href="item.href"
            :target="item.external ? '_blank' : undefined"
            :rel="item.external ? 'noopener noreferrer' : undefined"
            class="whitespace-nowrap"
          >
            <NavLinkContent :item="item" :locale="locale" />
          </a>
        </NavigationMenuLink>
      </li>
    </ul>
  </li>
</template>
