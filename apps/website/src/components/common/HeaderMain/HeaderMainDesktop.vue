<script setup lang="ts">
import { computed } from 'vue'
import NavigationMenu from '@/components/ui/navigation-menu/NavigationMenu.vue'
import NavigationMenuContent from '@/components/ui/navigation-menu/NavigationMenuContent.vue'
import NavigationMenuItem from '@/components/ui/navigation-menu/NavigationMenuItem.vue'
import NavigationMenuLink from '@/components/ui/navigation-menu/NavigationMenuLink.vue'
import NavigationMenuList from '@/components/ui/navigation-menu/NavigationMenuList.vue'
import NavigationMenuTrigger from '@/components/ui/navigation-menu/NavigationMenuTrigger.vue'
import { cn } from '@comfyorg/tailwind-utils'

import { navigationMenuTriggerStyle } from '@/components/ui/navigation-menu/navigationMenuTriggerStyle'

import { isHrefActive, useCurrentPath } from '@/composables/useCurrentPath'
import { NO_HUB_SECTIONS, getMainNavigation } from '@/data/mainNavigation'
import type {
  HubMenuPreviews,
  HubSections,
  NavItem
} from '@/data/mainNavigation'
import type { Locale } from '@/i18n/translations'
import NavDropdownBody from './NavDropdownBody.vue'
import NewBadge from './NewBadge.vue'

const {
  locale = 'en',
  hubSections = NO_HUB_SECTIONS,
  hubPreviews
} = defineProps<{
  locale?: Locale
  hubSections?: HubSections
  hubPreviews?: HubMenuPreviews
}>()
const mainNavigation = computed(() =>
  getMainNavigation(locale, hubSections, hubPreviews)
)
const currentPath = useCurrentPath()

function ownsPath(navItem: NavItem, path: string): boolean {
  if (navItem.href) return isHrefActive(navItem.href, path)
  return (
    !!navItem.activePathPrefix &&
    `${path}/`.startsWith(navItem.activePathPrefix)
  )
}

function isNavItemActive(navItem: NavItem, path: string): boolean {
  if (ownsPath(navItem, path)) return true
  if (!navItem.columns) return false
  return (
    !mainNavigation.value.some((item) => ownsPath(item, path)) &&
    navItem.columns.some((column) =>
      column.items.some((item) => isHrefActive(item.href, path))
    )
  )
}
</script>

<template>
  <NavigationMenu viewport-align="start" data-testid="desktop-nav-links">
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
              <span>{{ navItem.label }}</span>
              <span v-if="navItem.badge" class="inline-flex">
                <NewBadge :locale="locale" size="xxs" />
              </span>
            </span>
          </NavigationMenuTrigger>
          <NavigationMenuContent class="w-auto" data-testid="nav-dropdown">
            <NavDropdownBody
              :columns="navItem.columns"
              :featured="navItem.featured"
              :explore-link="navItem.exploreLink"
              :locale
              :current-path="currentPath"
            />
          </NavigationMenuContent>
        </template>
        <NavigationMenuLink
          v-else
          as-child
          :active="isNavItemActive(navItem, currentPath)"
          :class="
            cn(navigationMenuTriggerStyle(), 'flex-row gap-1 whitespace-nowrap')
          "
        >
          <a :href="navItem.href">
            <span class="inline-block">{{ navItem.label }}</span>
            <span v-if="navItem.badge" class="inline-flex">
              <NewBadge :locale="locale" size="xxs" />
            </span>
          </a>
        </NavigationMenuLink>
      </NavigationMenuItem>
    </NavigationMenuList>
  </NavigationMenu>
</template>
