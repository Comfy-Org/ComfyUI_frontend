<script setup lang="ts">
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle
} from '@/components/ui/navigation-menu'

import {
  isHrefActive,
  useCurrentPath
} from '../../../composables/useCurrentPath'
import { getMainNavigation } from '../../../data/mainNavigation'
import type { NavItem } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'
import NavColumn from './NavColumn.vue'
import NavFeaturedCard from './NavFeaturedCard.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const mainNavigation = getMainNavigation(locale)
const currentPath = useCurrentPath()

function isNavItemActive(navItem: NavItem, path: string): boolean {
  if (navItem.href) return isHrefActive(navItem.href, path)
  return (
    navItem.columns?.some((column) =>
      column.items.some((item) => isHrefActive(item.href, path))
    ) ?? false
  )
}
</script>

<template>
  <NavigationMenu data-testid="desktop-nav-links">
    <NavigationMenuList>
      <NavigationMenuItem
        v-for="navItem in mainNavigation"
        :key="navItem.label"
      >
        <template v-if="navItem.columns?.length">
          <NavigationMenuTrigger
            :active="isNavItemActive(navItem, currentPath)"
          >
            {{ navItem.label }}
          </NavigationMenuTrigger>
          <NavigationMenuContent class="w-auto">
            <ul class="flex w-max gap-16">
              <NavFeaturedCard
                v-if="navItem.featured"
                :featured="navItem.featured"
              />
              <NavColumn
                v-for="column in navItem.columns"
                :key="column.header"
                :column="column"
                :locale="locale"
                :current-path="currentPath"
              />
            </ul>
          </NavigationMenuContent>
        </template>
        <NavigationMenuLink
          v-else
          as-child
          :active="isNavItemActive(navItem, currentPath)"
          :class="navigationMenuTriggerStyle()"
        >
          <a :href="navItem.href" class="ppformula-text-center">{{
            navItem.label
          }}</a>
        </NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</template>
