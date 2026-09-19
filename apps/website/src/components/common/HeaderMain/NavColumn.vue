<script setup lang="ts">
import NavigationMenuLink from '@/components/ui/navigation-menu/NavigationMenuLink.vue'

import { isHrefActive } from '../../../composables/useCurrentPath'
import type { NavColumn } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'
import NavLinkContent from './NavLinkContent.vue'

defineProps<{
  column: NavColumn
  locale: Locale
  currentPath: string
  layout?: 'column' | 'row'
}>()
</script>

<template>
  <li
    :class="
      layout === 'row' ? 'flex items-center gap-8' : 'flex flex-col space-y-4'
    "
  >
    <p
      v-if="column.header"
      class="font-formula text-xs font-medium text-primary-warm-gray"
      :class="layout === 'row' ? '' : 'pl-2'"
    >
      {{ column.header }}
    </p>
    <ul :class="layout === 'row' ? 'flex items-center gap-1' : 'flex flex-col'">
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
