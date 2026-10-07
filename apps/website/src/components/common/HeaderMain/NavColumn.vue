<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import NavigationMenuLink from '@/components/ui/navigation-menu/NavigationMenuLink.vue'

import { isHrefActive } from '@/composables/useCurrentPath'
import type { NavColumn } from '@/data/mainNavigation'
import { navLinkTarget } from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'
import NavColumnHeading from './NavColumnHeading.vue'
import NavLinkContent from './NavLinkContent.vue'

defineProps<{ column: NavColumn; locale: Locale; currentPath: string }>()
</script>

<template>
  <li
    :class="
      cn(
        'flex',
        column.placement === 'footer'
          ? 'items-center gap-4'
          : 'flex-col space-y-4'
      )
    "
  >
    <NavColumnHeading :column />
    <ul
      :class="
        cn(
          'flex',
          column.placement === 'footer' ? 'flex-row' : 'flex-col',
          column.kind && 'w-64 gap-1'
        )
      "
    >
      <li v-for="item in column.items" :key="item.label">
        <NavigationMenuLink
          as-child
          :active="isHrefActive(item.href, currentPath)"
          class="hover:bg-transparency-white-t4"
        >
          <a
            :href="item.href"
            v-bind="navLinkTarget(item)"
            :class="cn('whitespace-nowrap', column.kind && 'min-w-0')"
          >
            <NavLinkContent :item="item" :locale="locale" />
          </a>
        </NavigationMenuLink>
      </li>
    </ul>
  </li>
</template>
