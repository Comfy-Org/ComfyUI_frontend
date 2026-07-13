<script setup lang="ts">
import NavigationMenu from '@/components/ui/navigation-menu/NavigationMenu.vue'
import NavigationMenuContent from '@/components/ui/navigation-menu/NavigationMenuContent.vue'
import NavigationMenuItem from '@/components/ui/navigation-menu/NavigationMenuItem.vue'
import NavigationMenuLink from '@/components/ui/navigation-menu/NavigationMenuLink.vue'
import NavigationMenuList from '@/components/ui/navigation-menu/NavigationMenuList.vue'
import NavigationMenuTrigger from '@/components/ui/navigation-menu/NavigationMenuTrigger.vue'
import { navigationMenuTriggerStyle } from '@/components/ui/navigation-menu/navigationMenuTriggerStyle'

import {
  isHrefActive,
  useCurrentPath
} from '../../../composables/useCurrentPath'
import { getMainNavigation } from '../../../data/mainNavigation'
import type { NavItem } from '../../../data/mainNavigation'
import type { Locale } from '../../../i18n/translations'
import NavColumn from './NavColumn.vue'
import NavFeaturedCard from './NavFeaturedCard.vue'
import NewBadge from './NewBadge.vue'

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
            <span class="inline-flex items-center gap-1">
              <span class="ppformula-text-center">{{ navItem.label }}</span>
              <NewBadge v-if="navItem.badge" :locale="locale" size="xxs" />
            </span>
          </NavigationMenuTrigger>
          <NavigationMenuContent class="w-auto" data-testid="nav-dropdown">
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
