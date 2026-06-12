<script setup lang="ts">

import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger
} from '../ui/navigation-menu'
import Badge from './Badge.vue'
import NavigationMenuIndicator from '../ui/navigation-menu/NavigationMenuIndicator.vue'

type NavDropdownItem = {
  label: string
  href: string
  badge?: string
  external?: boolean
}

export type NavLink = {
  label: string
  href?: string
  items?: NavDropdownItem[]
}

const { link, currentPath } = defineProps<{
  link: NavLink
  currentPath: string
}>()
</script>

<template>
  <NavigationMenuItem>
    <NavigationMenuLink
      v-if="!link.items?.length"
      :href="link.href"
      :data-active="currentPath === link.href || undefined"
    >
      {{ link.label }}
    </NavigationMenuLink>

    <template v-else>
      <NavigationMenuTrigger>
        {{ link.label }}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <NavigationMenuLink
          v-for="item in link.items"
          :key="item.href"
          :href="item.href"
          :data-active="currentPath === item.href || undefined"
        >
          {{ item.label }}
          <Badge v-if="item.badge">
            {{ item.badge }}
          </Badge>
          <NavigationMenuIndicator />
        </NavigationMenuLink>
      </NavigationMenuContent>
    </template>
  </NavigationMenuItem>
</template>
