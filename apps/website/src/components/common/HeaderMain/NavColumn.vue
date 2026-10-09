<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import NavigationMenuLink from '@/components/ui/navigation-menu/NavigationMenuLink.vue'

import { isHrefActive } from '@/composables/useCurrentPath'
import type { NavColumn } from '@/data/mainNavigation'
import { navLinkTarget } from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'
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
      cn(
        layout === 'row'
          ? 'flex items-center gap-8'
          : 'flex flex-col space-y-4',
        column.description && 'w-60'
      )
    "
  >
    <div v-if="column.header" :class="layout === 'row' ? '' : 'pl-2'">
      <p
        class="font-formula text-xs font-medium text-primary-warm-gray uppercase"
      >
        {{ column.header }}
      </p>
      <p
        v-if="column.description"
        class="mt-1 text-sm whitespace-nowrap text-primary-warm-gray"
      >
        {{ column.description }}
      </p>
    </div>
    <ul
      :aria-label="column.header"
      :class="layout === 'row' ? 'flex items-center gap-1' : 'flex flex-col'"
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
            class="whitespace-nowrap"
          >
            <NavLinkContent :item="item" :locale="locale" />
          </a>
        </NavigationMenuLink>
      </li>
    </ul>
    <div v-if="column.allLink" class="mt-auto pl-2">
      <Button
        as="a"
        variant="link"
        size="sm"
        class="md:text-xs"
        :href="column.allLink.href"
      >
        {{ column.allLink.label }}
      </Button>
    </div>
  </li>
</template>
