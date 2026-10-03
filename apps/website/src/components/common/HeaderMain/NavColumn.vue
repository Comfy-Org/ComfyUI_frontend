<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import NavigationMenuLink from '@/components/ui/navigation-menu/NavigationMenuLink.vue'

import { isHrefActive } from '../../../composables/useCurrentPath'
import type { NavColumn } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'
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
    <div class="pl-2">
      <p class="font-formula text-sm font-medium text-primary-warm-gray">
        {{ column.header }}
      </p>
      <p
        v-if="column.description"
        class="mt-1 text-xs text-primary-warm-gray/70"
      >
        {{ column.description }}
      </p>
    </div>
    <ul
      :class="
        cn('flex', column.placement === 'footer' ? 'flex-row' : 'flex-col')
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
